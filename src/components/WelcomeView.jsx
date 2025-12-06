import React from 'react';
import { Music } from 'lucide-react';
import spotifyIcon from '../assets/spotify-icon-white.png';

export default function WelcomeView({ onLogin }) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-black flex items-center justify-center p-4">
            <div className="text-center max-w-2xl">
                <Music className="w-24 h-24 text-green-400 mx-auto mb-6" />
                <h1 className="text-6xl font-bold text-white mb-4">Songclash</h1>
                <p className="text-xl text-gray-300 mb-8">
                    Songclash is a music matcher that analyses your playlists to find common ground with friends. Create a session, invite friends, and generate a shared-song playlist you all enjoy.
                </p>
                <button
                    onClick={onLogin}
                    className="bg-red-500 hover:bg-red-600 text-white font-bold py-4 px-8 rounded-full text-lg transition-all transform hover:scale-105 flex items-center justify-center gap-3 mx-auto"
                >
                    <Music className="w-8 h-8" />
                    Login with Apple Music
                </button>
            </div>
        </div>
    );
}
