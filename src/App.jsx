import React, { useState, useEffect } from 'react';
import { Users, Music, Share2, LogOut, Loader2, PlusCircle } from 'lucide-react';
import { db } from './firebase';
import { ref, set, get, update, onValue } from 'firebase/database';

// TODO: Replace with your Spotify Client ID
const CLIENT_ID = '2e236609e1664658baf7c693a9de776f';
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
        handleAuth();
    }, []);

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
        partySession.members.forEach((member, i) => {
            partySession.members.slice(i + 1).forEach(otherMember => {
                if (member.likedSongs && otherMember.likedSongs) {
                    const common = member.likedSongs.filter(s =>
                        otherMember.likedSongs.includes(s)
                    );
                    if (common.length > 0) {
                        groups.push({
                            members: [member.name, otherMember.name],
                            commonSongs: common.length,
                            percentage: Math.round(
                                (common.length / Math.min(member.likedSongs.length, otherMember.likedSongs.length)) * 100
                            ),
                        });
                    }
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
        return (
            <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-black flex items-center justify-center p-4">
                <div className="text-center max-w-2xl">
                    <Music className="w-24 h-24 text-green-400 mx-auto mb-6" />
                    <h1 className="text-6xl font-bold text-white mb-4">Song Clash</h1>
                    <p className="text-xl text-gray-300 mb-8">
                        Connect with friends through your shared music taste. Login with Spotify to automatically group with people who like the same songs!
                    </p>
                    <button
                        onClick={redirectToSpotify}
                        className="bg-green-500 hover:bg-green-600 text-white font-bold py-4 px-8 rounded-full text-lg transition-all transform hover:scale-105"
                    >
                        Login with Spotify
                    </button>
                </div>
            </div>
        );
    }

    if (view === 'menu') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-black p-8">
                <div className="max-w-4xl mx-auto">
                    <div className="flex justify-between items-center mb-8">
                        <div className="flex items-center gap-4">
                            {currentUser?.images?.[0] && (
                                <img src={currentUser.images[0].url} alt="Profile" className="w-16 h-16 rounded-full" />
                            )}
                            <div>
                                <h2 className="text-2xl font-bold text-white">{currentUser?.display_name}</h2>
                                <p className="text-gray-400">{likedSongs.length} liked songs</p>
                            </div>
                        </div>
                        <button onClick={logout} className="text-gray-400 hover:text-white">
                            <LogOut className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 hover:bg-white/20 transition-all cursor-pointer" onClick={createParty}>
                            <Users className="w-16 h-16 text-green-400 mb-4" />
                            <h3 className="text-2xl font-bold text-white mb-2">Create Party</h3>
                            <p className="text-gray-300">Start a new party session and invite your friends</p>
                        </div>

                        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8">
                            <Share2 className="w-16 h-16 text-blue-400 mb-4" />
                            <h3 className="text-2xl font-bold text-white mb-4">Join Party</h3>
                            <input
                                type="text"
                                placeholder="Enter party code"
                                className="w-full bg-white/20 text-white placeholder-gray-400 px-4 py-3 rounded-lg mb-4 outline-none focus:ring-2 focus:ring-blue-400"
                                value={partyCode}
                                onChange={(e) => setPartyCode(e.target.value.toUpperCase())}
                                maxLength={6}
                            />
                            <button
                                onClick={() => joinParty(partyCode)}
                                disabled={partyCode.length !== 6}
                                className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 text-white font-bold py-3 rounded-lg transition-all"
                            >
                                Join
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (view === 'party') {
        const matches = calculateMatches();
        const playlist = createPlaylist();
        const totalMinutes = Math.round(playlist.length * 3.5);

        return (
            <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-black p-8">
                <div className="max-w-6xl mx-auto">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h1 className="text-4xl font-bold text-white mb-2">Party Session</h1>
                            <div className="flex items-center gap-4">
                                <p className="text-xl text-gray-300">Code: <span className="font-mono bg-white/20 px-3 py-1 rounded">{partyCode}</span></p>
                                <button
                                    onClick={() => {
                                        const url = `${window.location.origin}?join=${partyCode}`;
                                        if (navigator.share) {
                                            navigator.share({
                                                title: 'Join my SongClash Party!',
                                                text: `Let's see if we have the same music taste! 🎵 Join with code: ${partyCode}`,
                                                url: url
                                            }).catch(console.error);
                                        } else {
                                            navigator.clipboard.writeText(url);
                                            alert('Party link copied to clipboard!');
                                        }
                                    }}
                                    className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-full flex items-center gap-2 text-sm font-bold transition-all"
                                >
                                    <Share2 className="w-4 h-4" />
                                    Invite Friends
                                </button>
                            </div>
                        </div>
                        <button onClick={() => setView('menu')} className="text-gray-400 hover:text-white">
                            <LogOut className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8 mb-8">
                        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
                            <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                                <Users className="w-6 h-6 text-green-400" />
                                Party Members ({partySession?.members.length})
                            </h3>
                            <div className="space-y-3">
                                {partySession?.members.map(member => (
                                    <div key={member.id} className="bg-white/10 rounded-lg p-4">
                                        <p className="text-white font-semibold">{member.name}</p>
                                        <p className="text-gray-400 text-sm">{member.likedSongs ? member.likedSongs.length : 0} liked songs</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
                            <h3 className="text-2xl font-bold text-white mb-4">Match Analysis</h3>
                            {matches && matches.groups.length > 0 ? (
                                <div className="space-y-3">
                                    {matches.groups.map((group, i) => (
                                        <div key={i} className="bg-white/10 rounded-lg p-4">
                                            <p className="text-white font-semibold">{group.members.join(' & ')}</p>
                                            <p className="text-green-400">{group.commonSongs} songs in common ({group.percentage}% match)</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-gray-400">Waiting for more members to join...</p>
                            )}
                        </div>
                    </div>

                    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                                <Music className="w-6 h-6 text-purple-400" />
                                Party Playlist ({playlist.length} songs, ~{totalMinutes} minutes)
                            </h3>
                            {playlist.length > 0 && (
                                <button
                                    onClick={createSpotifyPlaylist}
                                    className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-full flex items-center gap-2 text-sm font-bold transition-all"
                                >
                                    <PlusCircle className="w-4 h-4" />
                                    Save to Spotify
                                </button>
                            )}
                        </div>
                        {playlist.length > 0 ? (
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                                {playlist.map((song, i) => (
                                    <div key={i} className="bg-white/10 rounded-lg p-3 flex justify-between items-center">
                                        <div>
                                            <p className="text-white font-semibold">{song.name}</p>
                                            <p className="text-gray-400 text-sm">{song.artists}</p>
                                        </div>
                                        <span className="text-green-400 text-sm">
                                            {matches.sharedSongs.find(s => s.songId === song.id)?.count} members
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-gray-400">No shared songs yet. Invite more friends!</p>
                        )}
                    </div>
                </div>
            </div>

        );
    }
}
