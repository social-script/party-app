import React from 'react';
import { Music } from 'lucide-react';

export default function WelcomeView({ onLogin }) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-black flex items-center justify-center p-4">
            <div className="text-center max-w-2xl">
                <Music className="w-24 h-24 text-green-400 mx-auto mb-6" />
                <h1 className="text-6xl font-bold text-white mb-4">Songclash</h1>
                <p className="text-xl text-gray-300 mb-8">
                    Connect with friends through your shared music taste. Login with Spotify to automatically group with people who like the same songs!
                </p>
                <button
                    onClick={onLogin}
                    className="bg-spotify-green hover:bg-[#1ed760] text-spotify-black font-bold py-4 px-8 rounded-full text-lg transition-all transform hover:scale-105 flex items-center justify-center gap-3 mx-auto"
                >
                    <img src="/src/assets/spotify-icon-white.png" alt="Spotify" className="w-8 h-8" />
                    Login with Spotify
                </button>
            </div>
        </div>
    );
}
