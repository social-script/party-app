import React from 'react';
import { Users, Music, Share2, LogOut, PlusCircle } from 'lucide-react';

export default function PartyView({
    partyCode,
    partySession,
    matches,
    playlist,
    totalMinutes,
    onCreateSpotifyPlaylist,
    onLeaveParty
}) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-black p-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-4xl font-bold text-white mb-2">Songclash Session</h1>
                        <div className="flex items-center gap-4">
                            <p className="text-xl text-gray-300">Code: <span className="font-mono bg-white/20 px-3 py-1 rounded">{partyCode}</span></p>
                            <button
                                onClick={() => {
                                    const url = `${window.location.origin}?join=${partyCode}`;
                                    const text = encodeURIComponent(`Let's see if we have the same music taste! 🎵 Join my Songclash with code: ${partyCode}\n${url}`);
                                    window.open(`https://wa.me/?text=${text}`, '_blank');
                                }}
                                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-full flex items-center gap-2 text-sm font-bold transition-all"
                            >
                                <Share2 className="w-4 h-4" />
                                Share on WhatsApp
                            </button>
                        </div>
                    </div>
                    <button onClick={onLeaveParty} className="text-gray-400 hover:text-white">
                        <LogOut className="w-6 h-6" />
                    </button>
                </div>

                <div className="grid md:grid-cols-2 gap-8 mb-8">
                    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
                        <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                            <Users className="w-6 h-6 text-green-400" />
                            Songclash Members ({partySession?.members.length})
                        </h3>
                        <div className="space-y-3">
                            {partySession?.members.map(member => (
                                <div key={member.id} className="bg-white/10 rounded-lg p-4">
                                    <p className="text-white font-semibold">{member.name}</p>
                                    <p className="text-gray-400 text-sm">{member.likedSongs ? member.likedSongs.length : 0} songs</p>
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
                            Songclash Playlist ({playlist.length} songs, ~{totalMinutes} minutes)
                        </h3>
                        {playlist.length > 0 && (
                            <button
                                onClick={onCreateSpotifyPlaylist}
                                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-full flex items-center gap-2 text-sm font-bold transition-all"
                                title="Save to Apple Music Library"
                            >
                                <PlusCircle className="w-4 h-4" />
                                Save to Apple Music
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
                <div className="mt-8 text-center">
                    <p className="text-gray-500 text-sm">Metadata provided by Apple Music</p>
                </div>
            </div>
        </div>
    );
}
