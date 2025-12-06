import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { db } from './firebase';
import { ref, set, get, update, onValue } from 'firebase/database';
import WelcomeView from './components/WelcomeView';
import MenuView from './components/MenuView';
import PartyView from './components/PartyView';

// Apple Music Config
const DEVELOPER_TOKEN = import.meta.env.VITE_APPLE_DEVELOPER_TOKEN;
const APP_NAME = import.meta.env.VITE_APPLE_APP_NAME || 'Songclash';
const APP_BUILD = import.meta.env.VITE_APPLE_APP_BUILD || '1.0.0';

export default function PartyApp() {
    const [view, setView] = useState('welcome');
    const [currentUser, setCurrentUser] = useState(null);
    const [musicKit, setMusicKit] = useState(null);
    const [partyCode, setPartyCode] = useState('');
    const [partySession, setPartySession] = useState(null);
    const [loading, setLoading] = useState(false);
    const [userSongs, setUserSongs] = useState([]);
    const [loadingMessage, setLoadingMessage] = useState('');

    useEffect(() => {
        // Initialize MusicKit
        const configureMusicKit = async () => {
            try {
                await window.MusicKit.configure({
                    developerToken: DEVELOPER_TOKEN,
                    app: {
                        name: APP_NAME,
                        build: APP_BUILD,
                    },
                });
                const mk = window.MusicKit.getInstance();
                setMusicKit(mk);

                // Check for existing authorization
                if (mk.isAuthorized) {
                    // There isn't a direct "get profile" quite like Spotify's /me in the simple sense,
                    // but we can assume auth is good. We might use a placeholder for name/ID if not easily available,
                    // or fetch a storefront endpoint.
                    // Apple Music User Token is handled internally by MusicKit.
                    // We'll generate a pseudo-ID or use the Music User Token if we really need a stable ID.
                    // For now, let's assume we can proceed if authorized.
                    // Important: MusicKit doesn't expose a stable numerical user ID easily.
                    // We might need to generate a session ID or use something strictly local for this app's "party" logic if we can't get a user ID.
                    // Actually, we can assume 'me' is the user. But for Firebase, we need an ID.
                    // Let's use the Music User Token (which effectively identifies the user) or generate a random one for the session if we don't want to expose the token.,
                    // better yet, we can't see the user token. It's internal.
                    // Workaround: Generate a random ID for this session/browser and store it.
                    // Or ask user for a display name? MusicKit doesn't give display name easily either.
                    // Getting stricter: The pivot is real.
                    // Let's implement a simple "Enter Name" step if we can't get it, or just use "Apple Music User".
                    restoreSession(mk);
                }
            } catch (err) {
                console.error('MusicKit configuration error:', err);
            }
        };

        if (window.MusicKit) {
            configureMusicKit();
        } else {
            // Poll or wait for script load if needed, but script tag in head usually works.
            document.addEventListener('musickitloaded', configureMusicKit);
        }

        return () => {
            document.removeEventListener('musickitloaded', configureMusicKit);
        };
    }, []);

    // Save state to localStorage
    useEffect(() => {
        if (partyCode) localStorage.setItem('partyCode', partyCode);
        if (view) localStorage.setItem('view', view);
        if (currentUser) localStorage.setItem('currentUser', JSON.stringify(currentUser));
    }, [partyCode, view, currentUser]);

    // Restore session
    function restoreSession(mk) {
        const storedCode = localStorage.getItem('partyCode');
        const storedView = localStorage.getItem('view');
        const storedUser = localStorage.getItem('currentUser');

        if (storedUser) setCurrentUser(JSON.parse(storedUser));
        if (storedCode) setPartyCode(storedCode);
        if (storedView) setView(storedView);

        if (mk.isAuthorized && !storedUser) {
            // If authorized but no user in local storage, might want to just set a default or prompt.
            // For now, let's synthesize a user.
            // MusicKit doesn't provide user profile info like Spotify.
            const randomId = 'user_' + Math.random().toString(36).substr(2, 9);
            const user = { id: randomId, display_name: 'Apple Music User' };
            setCurrentUser(user);
            localStorage.setItem('currentUser', JSON.stringify(user));
            setView('menu');
        } else if (mk.isAuthorized && storedView === 'welcome') {
            setView('menu');
        }
    }


    // Listen for party updates
    useEffect(() => {
        if (partyCode && view === 'party') {
            const partyRef = ref(db, `parties/${partyCode}`);
            const unsubscribe = onValue(partyRef, (snapshot) => {
                const data = snapshot.val();
                if (data) {
                    setPartySession(data);
                } else {
                    alert('Songclash ended or does not exist.');
                    setView('menu');
                    setPartyCode('');
                    setPartySession(null);
                }
            });
            return () => unsubscribe();
        }
    }, [partyCode, view]);


    async function handleAuth() {
        if (!musicKit) return;
        setLoading(true);
        setLoadingMessage('Authenticating with Apple Music...');
        try {
            await musicKit.authorize();
            // Auth successful
            // Since we can't get a real User ID/Display Name easily from MusicKit without extra setup,
            // We'll create a local profile for this session.
            const randomId = 'user_' + Math.random().toString(36).substr(2, 9);
            const user = { id: randomId, display_name: 'Apple Music User' }; // Could prompt for name later
            setCurrentUser(user);
            setView('menu');

            // Pending join code logic
            const pendingJoinCode = localStorage.getItem('joinCode');
            if (pendingJoinCode) {
                setPartyCode(pendingJoinCode);
                localStorage.removeItem('joinCode');
            }

        } catch (error) {
            console.error('Apple Music Auth Error:', error);
            alert('Authentication failed.');
        }
        setLoading(false);
    }

    async function logout() {
        if (musicKit) {
            await musicKit.unauthorize();
        }
        setCurrentUser(null);
        setPartySession(null);
        setPartyCode('');
        setView('welcome');
        localStorage.clear();
    }

    // --- DATA FETCHING ---

    // Helper to fetch all pages
    async function fetchAll(requestFunction) {
        let allItems = [];
        let hasNext = true;
        let offset = 0;
        const limit = 100; // Apple Music limit usually around 100

        while (hasNext) {
            // MusicKit JS ensures offset handling if we use the API properly, 
            // but often we just need to iterate.
            // For simplicity in this plan, we'll implement a basic fetch.
            // MusicKit API usually returns { data: [...] } and next url.
            // We'll use the MusicKit library method with offset if available or raw API.
            // NOTE: musicKit.api.library.songs(null, { offset, limit }) might verify.

            try {
                const response = await requestFunction(offset, limit);
                if (response && response.length > 0) {
                    allItems.push(...response);
                    offset += response.length;
                    // Heuristic break if fewer than limit returned
                    if (response.length < limit) hasNext = false;
                } else {
                    hasNext = false;
                }
                setLoadingMessage(`Fetched ${allItems.length} items...`);
            } catch (e) {
                console.warn('Fetch error or end of list:', e);
                hasNext = false;
            }

            // Safety brake
            if (offset > 5000) hasNext = false;
        }
        return allItems;
    }

    async function fetchUserMusic() {
        if (!musicKit) return [];
        setLoading(true);
        setLoadingMessage('Fetching your library...');

        let allTracks = [];
        const seenIds = new Set();

        try {
            // 1. Fetch Library Songs
            setLoadingMessage('Fetching library songs...');
            // musicKit.api.library.songs() returns a promise resolving to the items.
            // We need to implement pagination manually or use 'offset'.

            const fetchLibrarySongs = (offset, limit) => musicKit.api.library.songs(null, { offset, limit });
            const librarySongsRaw = await fetchAll(fetchLibrarySongs);

            librarySongsRaw.forEach(item => {
                const id = item.id; // Apple Music ID
                const name = item.attributes.name;
                const artist = item.attributes.artistName;

                if (!seenIds.has(id)) {
                    seenIds.add(id);
                    allTracks.push({
                        id: id,
                        name: name,
                        artists: artist,
                        type: 'songs' // Apple Music type
                    });
                }
            });

            // 2. Fetch Playlists and their tracks
            setLoadingMessage('Fetching playlists...');
            const fetchPlaylists = (offset, limit) => musicKit.api.library.playlists(null, { offset, limit });
            const playlists = await fetchAll(fetchPlaylists);

            for (let i = 0; i < playlists.length; i++) {
                const playlist = playlists[i];
                setLoadingMessage(`Scanning playlist ${i + 1}/${playlists.length}: ${playlist.attributes.name}`);

                // Fetch tracks for this playlist
                // We access the playlist details. musicKit.api.library.playlist(id) might be needed to get tracks if not in summary.
                // Usually relationship 'tracks' is paginated.
                // Simplified: Fetch full playlist details.
                try {
                    const plDetails = await musicKit.api.library.playlist(playlist.id, { include: 'tracks' });
                    // Tracks might be in plDetails.relationships.tracks.data
                    if (plDetails && plDetails.relationships && plDetails.relationships.tracks && plDetails.relationships.tracks.data) {
                        const tracks = plDetails.relationships.tracks.data;
                        tracks.forEach(track => {
                            if (track.type === 'songs' || track.type === 'library-songs') {
                                if (!seenIds.has(track.id)) {
                                    seenIds.add(track.id);
                                    allTracks.push({
                                        id: track.id,
                                        name: track.attributes.name,
                                        artists: track.attributes.artistName,
                                        type: 'songs'
                                    });
                                }
                            }
                        });
                    }
                } catch (pe) {
                    console.warn('Failed to fetch playlist details', pe);
                }
            }

        } catch (e) {
            console.error('Error fetching user music:', e);
            alert('Error fetching music. Please try again.');
        }

        return allTracks;
    }


    // --- PARTY LOGIC ---
    // (Reuse most of the existing logic, just swapping createSpotifyPlaylist)

    async function createParty() {
        setLoading(true);
        try {
            const songs = await fetchUserMusic();
            setUserSongs(songs);

            const code = generatePartyCode();
            const party = {
                code,
                host: currentUser.id,
                members: [{
                    id: currentUser.id,
                    name: currentUser.display_name,
                    likedSongs: songs.map(s => s.id), // Storing IDs
                }],
                createdAt: Date.now(),
            };

            await set(ref(db, `parties/${code}`), party);

            setPartyCode(code);
            setPartySession(party);
            setView('party');
        } catch (error) {
            console.error('Error creating party:', error);
            alert('Failed to create Songclash. Please try again.');
        }
        setLoading(false);
    }

    async function joinParty(code) {
        setLoading(true);
        try {
            const songs = await fetchUserMusic();
            setUserSongs(songs);

            const partyRef = ref(db, `parties/${code}`);
            const snapshot = await get(partyRef);

            if (!snapshot.exists()) {
                alert('Songclash not found. Please check the code.');
                setLoading(false);
                return;
            }

            const party = snapshot.val();
            const existingMember = party.members.find(m => m.id === currentUser.id);

            if (!existingMember) {
                const newMember = {
                    id: currentUser.id,
                    name: currentUser.display_name,
                    likedSongs: songs.map(s => s.id),
                };

                const updatedMembers = [...party.members, newMember];
                await update(partyRef, { members: updatedMembers });
                setPartySession({ ...party, members: updatedMembers });
            } else {
                const updatedMembers = party.members.map(m =>
                    m.id === currentUser.id
                        ? { ...m, likedSongs: songs.map(s => s.id) }
                        : m
                );
                await update(partyRef, { members: updatedMembers });
                setPartySession({ ...party, members: updatedMembers });
            }

            setPartyCode(code);
            setView('party');
        } catch (error) {
            console.error('Error joining party:', error);
            alert('Failed to join Songclash. Please try again.');
        }
        setLoading(false);
    }

    function generatePartyCode() {
        let code = '';
        const possible = '123456789';
        for (let i = 0; i < 6; i++) {
            code += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return code;
    }

    function calculateMatches() {
        if (!partySession || !partySession.members || partySession.members.length < 2) return null;

        const allSongIds = {};
        partySession.members.forEach(member => {
            if (member.likedSongs) {
                member.likedSongs.forEach(songId => {
                    if (!allSongIds[songId]) {
                        allSongIds[songId] = [];
                    }
                    allSongIds[songId].push(member.name);
                });
            }
        });

        const sharedSongs = Object.entries(allSongIds)
            .filter(([_, members]) => members.length >= 2)
            .map(([songId, members]) => ({
                songId,
                members,
                count: members.length,
            }));

        const groups = [];
        const memberSets = partySession.members.map(m => ({
            name: m.name,
            songs: new Set(m.likedSongs || [])
        }));

        memberSets.forEach((member, i) => {
            memberSets.slice(i + 1).forEach(otherMember => {
                const [smaller, larger] = member.songs.size < otherMember.songs.size
                    ? [member, otherMember]
                    : [otherMember, member];

                let commonCount = 0;
                for (const song of smaller.songs) {
                    if (larger.songs.has(song)) {
                        commonCount++;
                    }
                }

                if (commonCount > 0) {
                    groups.push({
                        members: [member.name, otherMember.name],
                        commonSongs: commonCount,
                        percentage: Math.round(
                            (commonCount / Math.min(member.songs.size, otherMember.songs.size)) * 100
                        ),
                    });
                }
            });
        });

        return { sharedSongs, groups };
    }

    function createPlaylist() {
        const matches = calculateMatches();
        if (!matches) return [];

        const playlistSongs = matches.sharedSongs
            .sort((a, b) => b.count - a.count)
            .map(s => userSongs.find(song => song.id === s.songId)) // This relies on local 'userSongs' containing the matched ID.
            // WARNING: If the match is from another user's library and not in ours, we might miss metadata if we only look in userSongs.
            // ideally we should have a 'allPossibleSongs' map, but for now we look in ours.
            // If we don't have it, we can't add it to our playlist anyway unless we fetch metadata by ID.
            // Optimally, matches should store metadata, or we fetch it.
            // But preserving logic as is for now.
            .filter(Boolean);

        const targetMinutes = 150;
        const avgSongLength = 3.5;
        const targetCount = Math.floor((targetMinutes * 60) / (avgSongLength * 60));

        return playlistSongs.slice(0, Math.min(targetCount, playlistSongs.length));
    }


    async function createAppleMusicPlaylist() {
        const playlist = createPlaylist();
        if (playlist.length === 0) {
            alert('No shared songs to add to playlist!');
            return;
        }

        if (!musicKit) return;

        setLoading(true);
        setLoadingMessage('Creating Apple Music playlist...');

        try {
            const name = `Songclash Party ${partyCode}`;
            const description = `A shared playlist created by Songclash for party ${partyCode}.`;
            const tracksData = playlist.map(song => ({
                id: song.id,
                type: 'songs' // Assuming 'songs' type for Apple Music catalog. If library resource, might behave differently.
            }));

            // MusicKit JS can create playlist directly in library
            await musicKit.api.library.createPlaylist({
                attributes: {
                    name,
                    description
                },
                relationships: {
                    tracks: {
                        data: tracksData
                    }
                }
            });

            alert(`Playlist "${name}" created successfully!`);
        } catch (error) {
            console.error('Error creating playlist:', error);
            alert(`Error: ${error.message || 'Failed to create playlist'}`);
        }
        setLoading(false);
    }


    // VIEWS
    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-black flex items-center justify-center p-4">
                <div className="text-center">
                    <Loader2 className="w-16 h-16 text-green-400 animate-spin mx-auto mb-4" />
                    <p className="text-white text-xl">{loadingMessage}</p>
                </div>
            </div>
        );
    }

    if (view === 'welcome') {
        return <WelcomeView onLogin={handleAuth} />;
    }

    if (view === 'menu') {
        return (
            <MenuView
                currentUser={currentUser}
                likedSongsCount={userSongs.length}
                onCreateParty={createParty}
                partyCode={partyCode}
                setPartyCode={setPartyCode}
                onJoinParty={joinParty}
                onLogout={logout}
            />
        );
    }

    if (view === 'party') {
        const matches = calculateMatches();
        const playlist = createPlaylist();
        const totalMinutes = Math.round(playlist.length * 3.5);

        return (
            <PartyView
                partyCode={partyCode}
                partySession={partySession}
                matches={matches}
                playlist={playlist}
                totalMinutes={totalMinutes}
                onCreateSpotifyPlaylist={createAppleMusicPlaylist} // Renamed prop usage in component later
                onLeaveParty={() => setView('menu')}
            />
        );
    }
}
