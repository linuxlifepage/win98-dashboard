import os
import sqlite3
import json
import math # Import the math module
from flask import Flask, request, jsonify, g

app = Flask(__name__)
DATABASE = '/data/config.db' # Path inside the container, mapped to a volume

# --- Default Icon Configuration ---
# Extracted from index.html (adjust links as needed)
DEFAULT_ICONS = {
    "jenkins": {"link": "#", "imageSrc": "icons/placeholder.png", "name": "Jenkins"},
    "grafana": {"link": "#", "imageSrc": "icons/pack/grafana.png", "name": "Grafana"},
    "prometheus": {"link": "#", "imageSrc": "icons/pack/prometheus.png", "name": "Prometheus"},
    "alertmanager": {"link": "#", "imageSrc": "icons/alertmanager.png", "name": "Alertmanager"},
    "gitlab": {"link": "#", "imageSrc": "icons/pack/gitlab.png", "name": "Gitlab"},
    "proxmox": {"link": "#", "imageSrc": "icons/pack/proxmox.png", "name": "Proxmox"},
    "kibana": {"link": "#", "imageSrc": "icons/pack/kibana.png", "name": "Kibana"},
    "gitea": {"link": "#", "imageSrc": "icons/pack/gitea.png", "name": "Gitea"},
    "agentdvr": {"link": "#", "imageSrc": "icons/placeholder.png", "name": "AgentDVR"},
    "portainer": {"link": "#", "imageSrc": "icons/pack/placeholder.png", "name": "Portainer"},
    "docker": {"link": "#", "imageSrc": "icons/pack/docker.png", "name": "Docker"},
    "kubernetes": {"link": "#", "imageSrc": "icons/pack/kubernetes.png", "name": "Kubernetes"},
    "ansible": {"link": "#", "imageSrc": "icons/placeholder.png", "name": "Ansible"},
    "terraform": {"link": "#", "imageSrc": "icons/pack/terraform.png", "name": "Terraform"},
    "vault": {"link": "#", "imageSrc": "icons/pack/vault.png", "name": "Vault"},
    "consul": {"link": "#", "imageSrc": "icons/placeholder.png", "name": "Consul"},
    "etcd": {"link": "#", "imageSrc": "icons/placeholder.png", "name": "etcd"},
    "zabbix": {"link": "#", "imageSrc": "icons/pack/zabbix.png", "name": "Zabbix"},
    "nagios": {"link": "#", "imageSrc": "icons/placeholder.png", "name": "Nagios"},
    "rancher": {"link": "#", "imageSrc": "icons/placeholder.png", "name": "Rancher"},
    "openshift": {"link": "#", "imageSrc": "icons/pack/openshift.png", "name": "OpenShift"}
}
# Define default positions (simple grid layout for initial state)
DEFAULT_POSITIONS = {}
icon_keys = list(DEFAULT_ICONS.keys())
icon_width = 85  # Corresponds to 'small' size in getIconDimensions
icon_height = 75 # Corresponds to 'small' size in getIconDimensions
padding = 5
max_rows = 8 # Estimate based on typical screen height / iconHeight
for index, icon_id in enumerate(icon_keys):
    col = math.floor(index / max_rows) # Use math.floor
    row = index % max_rows
    DEFAULT_POSITIONS[icon_id] = {
        "x": col * icon_width + padding,
        "y": row * icon_height + padding
    }

DEFAULT_SIZE = 'small'

# --- Database Functions ---

def get_db():
    """Opens a new database connection if there is none yet for the
    current application context.
    """
    db_path = DATABASE
    # Ensure the directory exists
    db_dir = os.path.dirname(db_path)
    if not os.path.exists(db_dir):
        try:
            os.makedirs(db_dir)
            print(f"Created database directory: {db_dir}")
        except OSError as e:
            print(f"Error creating directory {db_dir}: {e}")
            # Handle error appropriately, maybe raise it

    if not hasattr(g, 'sqlite_db'):
        try:
            g.sqlite_db = sqlite3.connect(db_path)
            g.sqlite_db.row_factory = sqlite3.Row # Return rows as dict-like objects
            print(f"Database connection opened to {db_path}")
        except sqlite3.Error as e:
            print(f"Error connecting to database {db_path}: {e}")
            # Handle error, maybe return None or raise
            g.sqlite_db = None # Ensure it's None if connection failed
    return g.sqlite_db


@app.teardown_appcontext
def close_db(error):
    """Closes the database again at the end of the request."""
    if hasattr(g, 'sqlite_db') and g.sqlite_db is not None:
        g.sqlite_db.close()
        print("Database connection closed.")


def init_db():
    """Initializes the database with default configuration if empty."""
    db = get_db()
    if db is None:
        print("Cannot initialize DB: No connection.")
        return

    try:
        # Use 'IF NOT EXISTS' to avoid errors if table already exists
        db.execute('''
            CREATE TABLE IF NOT EXISTS configurations (
                id TEXT PRIMARY KEY,
                icons TEXT,
                positions TEXT,
                size TEXT
            )
        ''')
        db.commit() # Commit table creation

        # Check if default config exists
        cursor = db.execute('SELECT id FROM configurations WHERE id = ?', ('default',))
        if cursor.fetchone() is None:
            print("Initializing default configuration in DB...")
            # Insert the defined defaults
            db.execute('INSERT INTO configurations (id, icons, positions, size) VALUES (?, ?, ?, ?)',
                       ('default', json.dumps(DEFAULT_ICONS), json.dumps(DEFAULT_POSITIONS), DEFAULT_SIZE))
            db.commit()
            print("Default configuration initialized.")
        else:
            print("Default configuration already exists.")
    except sqlite3.Error as e:
        print(f"Database error during init_db: {e}")
        # Consider rolling back if necessary, though CREATE TABLE IF NOT EXISTS is usually safe


@app.cli.command('initdb')
def initdb_command():
    """Creates the database tables."""
    with app.app_context():
        init_db()
        print('Initialized the database.')

# --- API Routes ---

@app.route('/api/config', methods=['GET'])
def get_config():
    db = get_db()
    if db is None:
        return jsonify({"error": "Database connection error"}), 500
    try:
        # Ensure DB is initialized if accessed for the first time via API
        # init_db() # Calling init_db here might cause issues with request context, better to ensure it's run on startup
        cursor = db.execute('SELECT icons, positions, size FROM configurations WHERE id = ?', ('default',))
        config_row = cursor.fetchone()
        if config_row:
            config = {
                "icons": json.loads(config_row['icons'] or '{}'),
                "positions": json.loads(config_row['positions'] or '{}'),
                "size": config_row['size'] or 'small'
            }
            return jsonify(config)
        else:
            # If 'default' row is missing after startup, something is wrong
            print("Error: Default configuration row not found in DB.")
            # Attempt to re-initialize (might indicate a volume issue or prior error)
            init_db()
            # Try fetching again
            cursor = db.execute('SELECT icons, positions, size FROM configurations WHERE id = ?', ('default',))
            config_row = cursor.fetchone()
            if config_row:
                 config = {
                    "icons": json.loads(config_row['icons'] or '{}'),
                    "positions": json.loads(config_row['positions'] or '{}'),
                    "size": config_row['size'] or 'small'
                 }
                 return jsonify(config)
            else:
                 # Still not found, return error
                 return jsonify({"error": "Default configuration missing and could not be initialized"}), 500

    except sqlite3.Error as e:
        print(f"Database error on GET: {e}")
        return jsonify({"error": "Database error"}), 500
    except json.JSONDecodeError as e:
        print(f"JSON decode error on GET: {e}")
        return jsonify({"error": "Error decoding stored configuration"}), 500


@app.route('/api/config', methods=['PUT'])
def update_config():
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400

    data = request.get_json()
    icons = data.get('icons')
    positions = data.get('positions')
    size = data.get('size')

    # Basic validation
    if icons is None or positions is None or size is None:
        return jsonify({"error": "Missing 'icons', 'positions', or 'size' in request body"}), 400
    if not isinstance(icons, dict) or not isinstance(positions, dict) or not isinstance(size, str):
         return jsonify({"error": "Invalid data types for 'icons', 'positions', or 'size'"}), 400

    db = get_db()
    if db is None:
        return jsonify({"error": "Database connection error"}), 500
    try:
        # Ensure DB is initialized (though it should be by now)
        # init_db() # Avoid calling in request context if possible
        db.execute('''
            UPDATE configurations SET icons = ?, positions = ?, size = ?
            WHERE id = ?
        ''', (json.dumps(icons), json.dumps(positions), size, 'default'))
        db.commit()
        print("Configuration updated in DB.")
        return jsonify({"message": "Configuration updated successfully"}), 200
    except sqlite3.Error as e:
        print(f"Database error on PUT: {e}")
        db.rollback() # Rollback changes on error
        return jsonify({"error": "Database error during update"}), 500

# Initialize DB when Flask app starts (if running directly or via Gunicorn)
# This ensures the table and default row exist before requests come in.
with app.app_context():
    init_db()

if __name__ == '__main__':
    # This block is mainly for local testing, Gunicorn runs the app in production
    app.run(host='0.0.0.0', port=5000)