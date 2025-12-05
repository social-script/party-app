import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { db } from './firebase';
import { ref, set, get, update, onValue } from 'firebase/database';
import WelcomeView from './components/WelcomeView';
import MenuView from './components/MenuView';
import PartyView from './components/PartyView';

// TODO: Replace with your Spotify Client ID
const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const REDIRECT_URI = window.location.origin;
const SCOPES = 'user-library-read user-read-private user-read-email playlist-modify-public playlist-modify-private';

export default function PartyApp() {
    const [view, setView] = useState('welcome');
    const [currentUser, setCurrentUser] = useState(null);
    const [accessToken, setAccessToken] = useState(null);
    const [partyCode, setPartyCode] = useState('');
    const [partySession, setPartySession] = useState(null);
    const [loading, setLoading] = useState(false);
    const [likedSongs, setLikedSongs] = useState([]);
    const [loadingMessage, setLoadingMessage] = useState('');

    useEffect(() => {
        // Restore state from localStorage
        const storedUser = localStorage.getItem('currentUser');
        const storedToken = localStorage.getItem('accessToken');
        const storedCode = localStorage.getItem('partyCode');
        const storedView = localStorage.getItem('view');

        if (storedUser) setCurrentUser(JSON.parse(storedUser));
        if (storedToken) setAccessToken(storedToken);
        if (storedCode) setPartyCode(storedCode);
        if (storedView) setView(storedView);

        handleAuth();
    }, []);

    // Save state to localStorage
    useEffect(() => {
        if (currentUser) localStorage.setItem('currentUser', JSON.stringify(currentUser));
        if (accessToken) localStorage.setItem('accessToken', accessToken);
        if (partyCode) localStorage.setItem('partyCode', partyCode);
        if (view) localStorage.setItem('view', view);
    }, [currentUser, accessToken, partyCode, view]);

    // Listen for party updates when in a party
    useEffect(() => {
        if (partyCode && view === 'party') {
            const partyRef = ref(db, `parties/${partyCode}`);
            const unsubscribe = onValue(partyRef, (snapshot) => {
                const data = snapshot.val();
                if (data) {
                    setPartySession(data);
                } else {
                    alert('Party ended or does not exist.');
                    setView('menu');
                    setPartyCode('');
                    setPartySession(null);
                }
            });

            return () => unsubscribe();
        }
    }, [partyCode, view]);

    // Handle Spotify OAuth
    async function handleAuth() {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const joinCode = params.get('join');

        if (joinCode) {
            localStorage.setItem('joinCode', joinCode);
        }

        if (code) {
            setLoading(true);
            setLoadingMessage('Authenticating with Spotify...');
            try {
                const token = await getAccessToken(code);
                setAccessToken(token);
                const profile = await fetchProfile(token);
                setCurrentUser(profile);
                window.history.replaceState({}, document.title, '/');
                setView('menu');

                // Check for pending join code
                const pendingJoinCode = localStorage.getItem('joinCode');
                if (pendingJoinCode) {
                    setPartyCode(pendingJoinCode);
                    localStorage.removeItem('joinCode');
                }
            } catch (error) {
                console.error('Auth error:', error);
                alert('Authentication failed. Please try again.');
            }
            setLoading(false);
        }
    }

    async function redirectToSpotify() {
        const verifier = generateCodeVerifier(128);
        const challenge = await generateCodeChallenge(verifier);

        localStorage.setItem('verifier', verifier);

        const params = new URLSearchParams({
            client_id: CLIENT_ID,
            response_type: 'code',
            redirect_uri: REDIRECT_URI,
            scope: SCOPES,
            code_challenge_method: 'S256',
            code_challenge: challenge,
        });

        window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
    }

    function generateCodeVerifier(length) {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < length; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

    async function generateCodeChallenge(codeVerifier) {
        const data = new TextEncoder().encode(codeVerifier);
        const digest = await window.crypto.subtle.digest('SHA-256', data);
        return btoa(String.fromCharCode.apply(null, [...new Uint8Array(digest)]))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }

    async function getAccessToken(code) {
        const verifier = localStorage.getItem('verifier');
        const params = new URLSearchParams({
            client_id: CLIENT_ID,
            grant_type: 'authorization_code',
            code,
            redirect_uri: REDIRECT_URI,
            code_verifier: verifier,
        });

        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params,
        });

        const data = await response.json();
        return data.access_token;
    }

    async function fetchProfile(token) {
        const response = await fetch('https://api.spotify.com/v1/me', {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.json();
    }

    async function fetchAllLikedSongs(token) {
        setLoadingMessage('Fetching your liked songs...');
        const allTracks = [];
        let url = 'https://api.spotify.com/v1/me/tracks?limit=50';

        while (url) {
            const response = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await response.json();

            const tracks = data.items.map(item => ({
                id: item.track.id,
                name: item.track.name,
                artists: item.track.artists.map(a => a.name).join(', '),
                uri: item.track.uri,
            }));

            allTracks.push(...tracks);
            setLoadingMessage(`Fetched ${allTracks.length} songs...`);
            url = data.next;
        }

        return allTracks;
    }

    async function createParty() {
        setLoading(true);
        try {
            const songs = await fetchAllLikedSongs(accessToken);
            setLikedSongs(songs);

            const code = generatePartyCode();
            const party = {
                code,
                host: currentUser.id,
                members: [{
                    id: currentUser.id,
                    name: currentUser.display_name,
                    likedSongs: songs.map(s => s.id),
                }],
                createdAt: Date.now(),
            };

            await set(ref(db, `parties/${code}`), party);

            setPartyCode(code);
            setPartySession(party);
            setView('party');
        } catch (error) {
            console.error('Error creating party:', error);
            alert('Failed to create party. Please try again.');
        }
        setLoading(false);
    }

    async function joinParty(code) {
        setLoading(true);
        try {
            const songs = await fetchAllLikedSongs(accessToken);
            setLikedSongs(songs);

            const partyRef = ref(db, `parties/${code}`);
            const snapshot = await get(partyRef);

            if (!snapshot.exists()) {
                alert('Party not found. Please check the code.');
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

                // Update local state immediately (though onValue will also catch it)
                setPartySession({ ...party, members: updatedMembers });
            } else {
                setPartySession(party);
            }

            setPartyCode(code);
            setView('party');
        } catch (error) {
            console.error('Error joining party:', error);
            alert('Failed to join party. Please try again.');
        }
        setLoading(false);
    }

    function generatePartyCode() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
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
            .map(s => likedSongs.find(song => song.id === s.songId))
            .filter(Boolean);

        const targetMinutes = 150;
        const avgSongLength = 3.5;
        const targetCount = Math.floor((targetMinutes * 60) / (avgSongLength * 60));

        return playlistSongs.slice(0, Math.min(targetCount, playlistSongs.length));
    }

    async function createSpotifyPlaylist() {
        const playlist = createPlaylist();
        if (playlist.length === 0) {
            alert('No shared songs to add to playlist!');
            return;
        }

        setLoading(true);
        setLoadingMessage('Creating Spotify playlist...');

        try {
            // 1. Create Playlist
            const createResponse = await fetch(`https://api.spotify.com/v1/users/${currentUser.id}/playlists`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: `SongClash Party ${partyCode}`,
                    description: `A shared playlist created by SongClash for party ${partyCode}.`,
                    public: false,
                }),
            });

            if (!createResponse.ok) {
                const errorData = await createResponse.json();
                console.error('Spotify API Error:', errorData);
                throw new Error(`Failed to create playlist: ${errorData.error?.message || createResponse.statusText}`);
            }

            const playlistData = await createResponse.json();

            // 2. Add Tracks
            const trackUris = playlist.map(song => song.uri);
            const addTracksResponse = await fetch(`https://api.spotify.com/v1/playlists/${playlistData.id}/tracks`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    uris: trackUris,
                }),
            });

            if (!addTracksResponse.ok) {
                const errorData = await addTracksResponse.json();
                console.error('Spotify API Error (Add Tracks):', errorData);
                throw new Error(`Failed to add tracks: ${errorData.error?.message || addTracksResponse.statusText}`);
            }

            alert(`Playlist "${playlistData.name}" created successfully!`);
        } catch (error) {
            console.error('Error creating playlist:', error);
            alert(`Error: ${error.message}`);
        }
        setLoading(false);
    }

    function logout() {
        setAccessToken(null);
        setCurrentUser(null);
        setPartySession(null);
        setPartyCode('');
        setView('welcome');
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
        return <WelcomeView onLogin={redirectToSpotify} />;
    }

    if (view === 'menu') {
        return (
            <MenuView
                currentUser={currentUser}
                likedSongsCount={likedSongs.length}
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
                onCreateSpotifyPlaylist={createSpotifyPlaylist}
                onLeaveParty={() => setView('menu')}
            />
        );
    }
}
