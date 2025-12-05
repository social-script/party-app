import React from 'react';
import { Users, Share2, LogOut } from 'lucide-react';

export default function MenuView({
    currentUser,
    likedSongsCount,
    onCreateParty,
    partyCode,
    setPartyCode,
    onJoinParty,
    onLogout
}) {
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
                            <p className="text-gray-400">{likedSongsCount} liked songs</p>
                        </div>
                    </div>
                    <button onClick={onLogout} className="text-gray-400 hover:text-white">
                        <LogOut className="w-6 h-6" />
                    </button>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 hover:bg-white/20 transition-all cursor-pointer" onClick={onCreateParty}>
                        <Users className="w-16 h-16 text-green-400 mb-4" />
                        <h3 className="text-2xl font-bold text-white mb-2">Create Song Clash</h3>
                        <p className="text-gray-300">Start a new Song Clash session and invite your friends</p>
                    </div>

                    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8">
                        <Share2 className="w-16 h-16 text-blue-400 mb-4" />
                        <h3 className="text-2xl font-bold text-white mb-4">Join Song Clash</h3>
                        <input
                            type="text"
                            placeholder="Enter Song Clash code"
                            className="w-full bg-white/20 text-white placeholder-gray-400 px-4 py-3 rounded-lg mb-4 outline-none focus:ring-2 focus:ring-blue-400"
                            value={partyCode}
                            onChange={(e) => setPartyCode(e.target.value.toUpperCase())}
                            maxLength={6}
                        />
                        <button
                            onClick={() => onJoinParty(partyCode)}
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
