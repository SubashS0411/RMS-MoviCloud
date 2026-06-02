"""
Google Drive Integration for Backup Storage

To use Google Drive backup, set these environment variables in your .env file:
  GDRIVE_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
  GDRIVE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
  GDRIVE_PROJECT_ID=your-project-id

Or alternatively, save the full JSON key file as 'gdrive-credentials.json' in the backend folder.

Setup steps:
1. Go to Google Cloud Console (https://console.cloud.google.com)
2. Create a new project or select existing one
3. Enable the Google Drive API
4. Create a Service Account:
   - Go to APIs & Services > Credentials
   - Click "Create Credentials" > "Service Account"
   - Fill in the details and create
   - Click on the service account > Keys > Add Key > Create new key > JSON
   - Download the JSON key file
5. Copy the values to your .env file OR save the JSON file in backend folder
6. Share your Google Drive backup folder with the service account email
"""

import os
import json
from pathlib import Path
from typing import Optional
from datetime import datetime

# Check if Google Drive packages are available
try:
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaInMemoryUpload
    GDRIVE_AVAILABLE = True
except ImportError:
    GDRIVE_AVAILABLE = False
    print("Google Drive packages not installed. Run: pip install google-api-python-client google-auth")


class GoogleDriveService:
    """Service for uploading backups to Google Drive"""
    
    SCOPES = ['https://www.googleapis.com/auth/drive.file']
    
    def __init__(self):
        self.service = None
        self.credentials_path = Path(__file__).parent.parent / 'gdrive-credentials.json'
        self._initialized = False
        self._error_message = None
    
    def _get_credentials_from_env(self):
        """Try to build credentials from environment variables"""
        service_email = os.getenv('GDRIVE_SERVICE_ACCOUNT_EMAIL')
        private_key = os.getenv('GDRIVE_PRIVATE_KEY')
        project_id = os.getenv('GDRIVE_PROJECT_ID')
        
        if not all([service_email, private_key, project_id]):
            print(f"[DEBUG] Credentials missing - email: {bool(service_email)}, key: {bool(private_key)}, project: {bool(project_id)}")
            return None
        
        # Handle escaped newlines in private key
        private_key = private_key.replace('\\n', '\n')
        
        credentials_info = {
            "type": "service_account",
            "project_id": project_id,
            "private_key": private_key,
            "client_email": service_email,
            "token_uri": "https://oauth2.googleapis.com/token",
        }
        
        try:
            creds = service_account.Credentials.from_service_account_info(
                credentials_info,
                scopes=self.SCOPES
            )
            print(f"[DEBUG] Credentials created successfully from env vars")
            return creds
        except Exception as e:
            print(f"[DEBUG] Failed to create credentials from env: {str(e)}")
            return None
    
    def initialize(self) -> bool:
        """Initialize the Google Drive service"""
        print(f"[DEBUG] Initializing Google Drive service. GDRIVE_AVAILABLE: {GDRIVE_AVAILABLE}")
        if not GDRIVE_AVAILABLE:
            self._error_message = "Google Drive packages not installed"
            return False
        
        try:
            # Try environment variables first
            print(f"[DEBUG] Trying to get credentials from env vars")
            credentials = self._get_credentials_from_env()
            
            # Fall back to JSON file
            if credentials is None:
                print(f"[DEBUG] Env vars failed, checking for JSON file at {self.credentials_path}")
                if not self.credentials_path.exists():
                    self._error_message = "No credentials found. Set GDRIVE_* env vars or provide gdrive-credentials.json"
                    print(f"[DEBUG] JSON file not found, credentials unavailable")
                    return False
                print(f"[DEBUG] Loading credentials from JSON file")
                credentials = service_account.Credentials.from_service_account_file(
                    str(self.credentials_path),
                    scopes=self.SCOPES
                )
            
            self.service = build('drive', 'v3', credentials=credentials)
            self._initialized = True
            print(f"[DEBUG] Google Drive service initialized successfully")
            return True
        except Exception as e:
            self._error_message = f"Failed to initialize Google Drive: {str(e)}"
            print(f"[DEBUG] Error initializing Google Drive: {str(e)}")
            return False
    
    def is_available(self) -> bool:
        """Check if Google Drive service is available"""
        if not self._initialized:
            self.initialize()
        return self._initialized and self.service is not None
    
    def get_error(self) -> Optional[str]:
        """Get the last error message"""
        return self._error_message
    
    def upload_backup(self, folder_id: str, backup_name: str, backup_data: dict) -> dict:
        """
        Upload backup data to Google Drive
        
        Args:
            folder_id: Google Drive folder ID
            backup_name: Name for the backup file
            backup_data: Dictionary containing the backup data
        
        Returns:
            dict with 'success', 'file_id', 'web_link' or 'error'
        """
        if not self.is_available():
            return {'success': False, 'error': self._error_message or 'Google Drive not available'}
        
        try:
            # Convert backup data to JSON
            json_content = json.dumps(backup_data, indent=2, default=str)
            
            # Create file metadata
            file_name = f"{backup_name.replace(' ', '_')}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
            file_metadata = {
                'name': file_name,
                'parents': [folder_id],
                'mimeType': 'application/json'
            }
            
            print(f"[DEBUG] Uploading backup to folder: {folder_id}")
            print(f"[DEBUG] File metadata: {file_metadata}")
            
            # Create media upload
            media = MediaInMemoryUpload(
                json_content.encode('utf-8'),
                mimetype='application/json',
                resumable=True
            )
            
            # Upload file (supports both regular folders and shared drives)
            file = self.service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id, webViewLink, name',
                supportsTeamDrives=True
            ).execute()
            
            print(f"[DEBUG] File uploaded successfully: {file.get('id')}")
            return {
                'success': True,
                'file_id': file.get('id'),
                'file_name': file.get('name'),
                'web_link': file.get('webViewLink')
            }
            
        except Exception as e:
            print(f"[DEBUG] Upload error: {str(e)}")
            return {'success': False, 'error': str(e)}
    
    def list_backups(self, folder_id: str) -> dict:
        """
        List backup files in the Google Drive folder
        
        Args:
            folder_id: Google Drive folder ID
        
        Returns:
            dict with 'success', 'files' or 'error'
        """
        if not self.is_available():
            return {'success': False, 'error': self._error_message or 'Google Drive not available'}
        
        try:
            query = f"'{folder_id}' in parents and mimeType='application/json' and trashed=false"
            results = self.service.files().list(
                q=query,
                fields='files(id, name, createdTime, size, webViewLink)',
                orderBy='createdTime desc',
                pageSize=50,
                supportsTeamDrives=True
            ).execute()
            
            files = results.get('files', [])
            return {'success': True, 'files': files}
            
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def delete_backup(self, file_id: str) -> dict:
        """
        Delete a backup file from Google Drive
        
        Args:
            file_id: Google Drive file ID
        
        Returns:
            dict with 'success' or 'error'
        """
        if not self.is_available():
            return {'success': False, 'error': self._error_message or 'Google Drive not available'}
        
        try:
            self.service.files().delete(fileId=file_id).execute()
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def download_backup(self, file_id: str) -> dict:
        """
        Download a backup file from Google Drive
        
        Args:
            file_id: Google Drive file ID
        
        Returns:
            dict with 'success', 'data' or 'error'
        """
        if not self.is_available():
            return {'success': False, 'error': self._error_message or 'Google Drive not available'}
        
        try:
            content = self.service.files().get_media(fileId=file_id).execute()
            data = json.loads(content.decode('utf-8'))
            return {'success': True, 'data': data}
        except Exception as e:
            return {'success': False, 'error': str(e)}


# Singleton instance
gdrive_service = GoogleDriveService()
