"""
Agent Client - Handles communication with VPS agents
"""

import requests
import json
from datetime import datetime
import threading
import time

class AgentClient:
    def __init__(self):
        self.panel_address = "64.188.70.12"
        self.agents = {}
        self.active_connections = {}
        
    def register_agent(self, agent_id, server_info):
        """Register a new agent"""
        self.agents[agent_id] = {
            'id': agent_id,
            'server_info': server_info,
            'last_heartbeat': datetime.now().isoformat(),
            'status': 'active'
        }
        
    def get_agent_status(self, agent_id):
        """Get agent status"""
        if agent_id in self.agents:
            return self.agents[agent_id]
        return None
        
    def send_command_to_agent(self, agent_id, command):
        """Send command to specific agent"""
        if agent_id not in self.agents:
            return {'success': False, 'error': 'Agent not found'}
            
        try:
            # In a real implementation, this would send HTTP request to agent
            # For now, return mock response
            return {
                'success': True,
                'output': f'Command "{command}" executed on agent {agent_id}',
                'timestamp': datetime.now().isoformat()
            }
        except Exception as e:
            return {'success': False, 'error': str(e)}
            
    def get_all_agents(self):
        """Get list of all registered agents"""
        return list(self.agents.values())
        
    def remove_agent(self, agent_id):
        """Remove agent from registry"""
        if agent_id in self.agents:
            del self.agents[agent_id]
            return True
        return False
    
    def process_heartbeat(self, data):
        """Process heartbeat from agent"""
        agent_id = data.get('server_id')
        
        if agent_id in self.agents:
            # Update existing agent
            self.agents[agent_id]['last_heartbeat'] = datetime.now().isoformat()
            self.agents[agent_id]['status'] = 'active'
            self.agents[agent_id]['stats'] = data
        else:
            # Register new agent from heartbeat
            self.register_agent(agent_id, {
                'server_info': data,
                'auto_registered': True
            })
        
        return {'success': True}
