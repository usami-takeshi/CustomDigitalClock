#!/usr/bin/env python3
"""
DigiClock 開発・確認用ローカルサーバー
静的ファイル配信 + ブラウザからの「対象フォルダをFinderで開く」APIに対応しています。

起動方法:
    python3 server.py
"""

import os
import sys
import subprocess
import urllib.parse
from http.server import HTTPServer, SimpleHTTPRequestHandler

PORT = 8000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

class DigiClockRequestHandler(SimpleHTTPRequestHandler):
    def do_POST(self):
        # ブラウザからのフォルダオープンリクエストを受信
        if self.path.startswith('/__open_folder'):
            query = urllib.parse.urlparse(self.path).query
            params = urllib.parse.parse_qs(query)
            target_rel = params.get('path', [''])[0]
            
            target_path = os.path.normpath(os.path.join(BASE_DIR, target_rel))
            
            # ディレクトリトラバーサル防止 (BASE_DIR配下のみ許可)
            if target_path.startswith(BASE_DIR) and os.path.exists(target_path):
                try:
                    if sys.platform == 'darwin':
                        subprocess.run(['open', target_path], check=True)
                    elif sys.platform.startswith('win'):
                        os.startfile(target_path)
                    else:
                        subprocess.run(['xdg-open', target_path], check=True)
                    
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(b'{"status":"ok"}')
                    return
                except Exception as e:
                    print(f"Error opening folder: {e}")
            
            self.send_response(400)
            self.end_headers()
            return
        
        return super().do_POST()

def main():
    os.chdir(BASE_DIR)
    server_address = ('', PORT)
    httpd = HTTPServer(server_address, DigiClockRequestHandler)
    print("=" * 60)
    print("  ⏰ DigiClock ローカルサーバー起動中")
    print(f"  URL: http://localhost:{PORT}")
    print("  ※ ブラウザからの「Finderで対象フォルダを開く」機能に対応")
    print("  終了するには Ctrl + C を押してください")
    print("=" * 60)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nサーバーを停止しました。")

if __name__ == '__main__':
    main()
