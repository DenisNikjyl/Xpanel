#!/usr/bin/env python3
"""
Xpanel - Production Runner
Simple script to run Xpanel in production mode
"""

import os
import sys
import eventlet
eventlet.monkey_patch()

from app import app, socketio

if __name__ == '__main__':
    # Set production environment
    os.environ['FLASK_ENV'] = 'production'
    
    # Get port from environment or use default
    port = int(os.environ.get('PORT', 5000))
    host = os.environ.get('HOST', '0.0.0.0')
    
    print(f"Starting Xpanel on {host}:{port}")
    
    # Run with SocketIO and eventlet
    print("Using eventlet server for WebSocket support")
    socketio.run(
        app,
        host=host,
        port=port,
        debug=False,
        use_reloader=False,
        log_output=True
    )
