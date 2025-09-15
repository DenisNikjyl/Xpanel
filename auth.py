#!/usr/bin/env python3
"""
Xpanel - Authentication Module
Complete authentication system with proper JWT handling
"""

from flask import Blueprint, request, jsonify, session
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity, verify_jwt_in_request
from werkzeug.security import generate_password_hash, check_password_hash
import json
import os
from datetime import datetime, timedelta
import uuid

# Create blueprint
auth_bp = Blueprint('auth', __name__)

# Simple file-based user storage
USERS_FILE = 'users.json'

def load_users():
    """Load users from file"""
    if os.path.exists(USERS_FILE):
        try:
            with open(USERS_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            pass
    
    # Default admin user
    default_users = {
        'admin': {
            'id': str(uuid.uuid4()),
            'username': 'admin',
            'password': generate_password_hash('admin123'),
            'role': 'admin',
            'created_at': datetime.now().isoformat(),
            'active': True
        }
    }
    save_users(default_users)
    return default_users

def save_users(users):
    """Save users to file"""
    try:
        with open(USERS_FILE, 'w', encoding='utf-8') as f:
            json.dump(users, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Error saving users: {e}")

# Load users on module import
users_db = load_users()

@auth_bp.route('/api/auth/login', methods=['POST'])
def login():
    """User login endpoint"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
        
        username = data.get('username', '').strip()
        password = data.get('password', '')
        
        if not username or not password:
            return jsonify({'success': False, 'message': 'Username and password required'}), 400
        
        # Check if user exists
        if username not in users_db:
            return jsonify({'success': False, 'message': 'Invalid credentials'}), 401
        
        user = users_db[username]
        
        # Check if user is active
        if not user.get('active', True):
            return jsonify({'success': False, 'message': 'Account disabled'}), 401
        
        # Verify password
        if not check_password_hash(user['password'], password):
            return jsonify({'success': False, 'message': 'Invalid credentials'}), 401
        
        # Create access token
        access_token = create_access_token(
            identity=username,
            expires_delta=timedelta(hours=24)
        )
        
        # Update last login
        users_db[username]['last_login'] = datetime.now().isoformat()
        save_users(users_db)
        
        return jsonify({
            'success': True,
            'access_token': access_token,
            'user': {
                'id': user['id'],
                'username': user['username'],
                'role': user['role']
            }
        })
        
    except Exception as e:
        print(f"Login error: {e}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500

@auth_bp.route('/api/auth/register', methods=['POST'])
def register():
    """User registration endpoint"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
        
        username = data.get('username', '').strip()
        password = data.get('password', '')
        role = data.get('role', 'user')
        
        if not username or not password:
            return jsonify({'success': False, 'message': 'Username and password required'}), 400
        
        if len(username) < 3:
            return jsonify({'success': False, 'message': 'Username must be at least 3 characters'}), 400
        
        if len(password) < 6:
            return jsonify({'success': False, 'message': 'Password must be at least 6 characters'}), 400
        
        # Check if user already exists
        if username in users_db:
            return jsonify({'success': False, 'message': 'Username already exists'}), 409
        
        # Create new user
        user_id = str(uuid.uuid4())
        users_db[username] = {
            'id': user_id,
            'username': username,
            'password': generate_password_hash(password),
            'role': role if role in ['admin', 'user'] else 'user',
            'created_at': datetime.now().isoformat(),
            'active': True
        }
        
        save_users(users_db)
        
        return jsonify({
            'success': True,
            'message': 'User created successfully',
            'user': {
                'id': user_id,
                'username': username,
                'role': users_db[username]['role']
            }
        })
        
    except Exception as e:
        print(f"Registration error: {e}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500

@auth_bp.route('/api/auth/verify', methods=['GET'])
@jwt_required()
def verify_token():
    """Verify JWT token"""
    try:
        current_user = get_jwt_identity()
        
        if current_user not in users_db:
            return jsonify({'success': False, 'message': 'User not found'}), 404
        
        user = users_db[current_user]
        
        if not user.get('active', True):
            return jsonify({'success': False, 'message': 'Account disabled'}), 401
        
        return jsonify({
            'success': True,
            'user': {
                'id': user['id'],
                'username': user['username'],
                'role': user['role']
            }
        })
        
    except Exception as e:
        print(f"Token verification error: {e}")
        return jsonify({'success': False, 'message': 'Invalid token'}), 401

@auth_bp.route('/api/auth/logout', methods=['POST'])
@jwt_required()
def logout():
    """User logout endpoint"""
    return jsonify({'success': True, 'message': 'Logged out successfully'})

@auth_bp.route('/api/auth/users', methods=['GET'])
@jwt_required()
def get_users():
    """Get all users (admin only)"""
    try:
        current_user = get_jwt_identity()
        
        if current_user not in users_db or users_db[current_user]['role'] != 'admin':
            return jsonify({'success': False, 'message': 'Admin access required'}), 403
        
        # Return users without passwords
        users_list = []
        for username, user in users_db.items():
            users_list.append({
                'id': user['id'],
                'username': user['username'],
                'role': user['role'],
                'created_at': user.get('created_at'),
                'last_login': user.get('last_login'),
                'active': user.get('active', True)
            })
        
        return jsonify({
            'success': True,
            'users': users_list
        })
        
    except Exception as e:
        print(f"Get users error: {e}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500

def require_auth():
    """Decorator function to require authentication"""
    try:
        verify_jwt_in_request()
        current_user = get_jwt_identity()
        
        if not current_user or current_user not in users_db:
            return jsonify({'success': False, 'message': 'Authentication required'}), 401
        
        if not users_db[current_user].get('active', True):
            return jsonify({'success': False, 'message': 'Account disabled'}), 401
        
        return None
    except Exception as e:
        return jsonify({'success': False, 'message': 'Invalid token'}), 401

def get_current_user():
    """Get current authenticated user"""
    try:
        current_user = get_jwt_identity()
        if current_user and current_user in users_db:
            return users_db[current_user]
        return None
    except:
        return None
