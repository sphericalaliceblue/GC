// ============================================================
// Config.gs — 設定値ファイル
// ここに各サービスのIDやキーを記入してください
// ============================================================

const CONFIG = {

  // --- Googleスプレッドシート ---
  SPREADSHEET_ID: 'YOUR_SPREADSHEET_ID', // スプレッドシートのURLに含まれる長いID
  SHEET_NAME: 'タスク一覧',

  // --- LINEワークス Bot ---
  LINE_WORKS: {
    API_BASE:       'https://www.worksapis.com/v1.0',
    AUTH_URL:       'https://auth.worksmobile.com/oauth2/v2.0/token',
    BOT_ID:         'YOUR_BOT_ID',
    CHANNEL_ID:     'YOUR_CHANNEL_ID',   // 通知を送る先のチャンネルID or ユーザーID
    CLIENT_ID:      'YOUR_CLIENT_ID',
    CLIENT_SECRET:  'YOUR_CLIENT_SECRET',
    SERVICE_ACCOUNT:'YOUR_SERVICE_ACCOUNT',
    PRIVATE_KEY:    'YOUR_PRIVATE_KEY',  // -----BEGIN RSA PRIVATE KEY----- から始まる文字列
    SCOPE:          'bot',
  },

  // --- Dify ---
  DIFY: {
    API_BASE: 'YOUR_DIFY_API_BASE_URL', // 例: https://api.dify.ai/v1
    API_KEY:  'YOUR_DIFY_API_KEY',
    USER_ID:  'gas-bot',
  },

  // --- 通知時刻（何時に通知チェックを実行するか） ---
  NOTIFICATION_HOUR: 9, // 朝9時（トリガー設定と合わせること）
};

// スプレッドシートの列番号（0始まり）
const COL = {
  ID:           0,
  TASK_NAME:    1,
  DEADLINE:     2,
  STATUS:       3,
  REQUESTER:    4,
  ASSIGNEE:     5,
  CREATED_AT:   6,
  UPDATED_AT:   7,
  NOTIFY_DATES: 8, // 通知予定日リスト（JSON配列を文字列として保存）
};

// ステータスの定義
const STATUS = {
  NOT_STARTED: '未着手',
  IN_PROGRESS: '進行中',
  ON_TRACK:    '順調',
  COMPLETE:    '完了',
};
