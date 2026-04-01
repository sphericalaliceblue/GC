// ============================================================
// Config.gs — 設定値ファイル
// ここに各サービスのIDやキーを記入してください
// ============================================================

const CONFIG = {

  // --- Googleスプレッドシート ---
  SPREADSHEET_ID: '1x13JQtqC6PJAmrvwar6Uy4mejDeiFko68HLZCsaqrko', // スプレッドシートのURLに含まれる長いID
  SHEET_NAME: 'タスク一覧',

  // --- LINEワークス Bot ---
  LINE_WORKS: {
    API_BASE:       'https://www.worksapis.com/v1.0',
    AUTH_URL:       'https://auth.worksmobile.com/oauth2/v2.0/token',
    BOT_ID:         '8608845',
    CHANNEL_ID:     'c69c5a6e-4aaf-065a-aa16-f5abad947a34',   // 通知を送る先のチャンネルID or ユーザーID
    CLIENT_ID:      'an_UO4EFx5M9wvqvcz1k',
    CLIENT_SECRET:  'IDgXxP7i8C',
    SERVICE_ACCOUNT:'hbokv.serviceaccount@solterra-group',
    PRIVATE_KEY:    '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDoxEIrWyp+uH+f\n7cARFTt4+bfR3sa7/rvKxBKB5iVlxXUqMRIN6IysM4/7/WC6+KgrCWpbPJBcSZF1\nNQ6jSqv2TSlSwEqlun1Rv8nSUsQa6taHe3JkUxa0p/XPEaJDw7OLDrjIMZFn6W14\n8+5EX+FCDY5+XQEh4FUan6mntCFbQ8f7QmDr531FXtLCiqwOmF8rqkT4J0wKMy8P\n3u4LfpeorwN8bFrvnLviRO1i9Eqb3J6/MWH2K/HReokIE5WLRQZhKNtscTVB7SJV\nMN1ollC66w+zySGzzoitNBQO9pMlc7QaOk+JvQUb77mNiXTNnpAocw4ILxdQWweH\n+cZvqPtDAgMBAAECggEAH5P4kh81Han0DoNXqjmiLuBZ8svxVDHT0kdVZ3AMpMjs\nA0RS+bYR147LOtl+FP+E+Qm29xe5UfvdEvSWvspzl9+R+psBxYgOVlfZjoIR/sDb\nR9gUhc3L58hdjbELvXvAUN43bVlkK5+8bUtSiM4lJivmp/gAHlNr2EfO4WSLnfDK\n5X0HT+gv8uRXGtFMPatdvwLo6nhXrC6ym5+d6QnOJTNLppJSdst6RTxLdw/Ug8Cp\n+84bG7cr1SECDGc//wIBpyzkicu8MWf48UY5T3w5zjKuR8b6DPJI3juxgJEdVTu9\ncsKopJBHq7Ou+tsFA8zZv+NTeU2W4kvLRoG2dEzy6QKBgQDyv461z21w43q78ohh\nVbJuAZbPnjJ3Gt+OqDnmopMtphJBIBDeSzMnsMGRl6r5yAZcE4MEvKjg7XlzH5Ap\n0D9fBFqbvgJzUEE4XhWeSdP3xmg+A/zrtsMZBSxRV5gvphtjwbUKCzsCviBz4lkw\nsrPZhy8UIjg8dwBQrCPsdUafdwKBgQD1eTTIXfAiHnL1+9luxbGViJ0mPuIkEnjy\n1JdsVv1Y0g3rrssAdDbfS1MGAk03CnPS/0s7Vxpx1B1xFZhIzAnsxxDE6pLdUn+I\nm8UNQj7l+MmFdUD43N+AzVvfgH/+QCuxkN2gRcmccG265iDOzpcNrd/wNKd3fLUM\n/8xhMLvtlQKBgHBGeVNOJWhZTqMvgjTC1kxbH83Xda/xFgV9eYpbF4e9kCPfGO44\nCekJr/4PEF2HTqm3vJmsSNAABnRg3OT6FNV1xhLSx39eV0wi+AzGSOwJMJ2+anT7\nizE/W0gkI5emVHTHW1zR5PFXztrKjkYf4V9zTysYyLnusI6fj94GQCvxAoGBAKI/\nM7D/zflvMML/bK63wnG4s04VIDmBcCnodBFqyddMN2FAzfKF3cLnMX/2Q30OzpF2\npg4Zu2PjNHaLNHVhT2oOBTpyZRIeNidf9fWWhKZSMzif0IrsylmC4qeucmrllTuv\nKZ2GowRgl1aCRssKZ3LmKu7Ejq/+YFiwNjFDGeOlAoGBAK+z1IepLIzrEF6KpmAH\nEnpH1Zt1yAeRc7EbGhk52jyv5mfZxUxhk0KyPo4Y9O3JyHwgm+/bd5vDhCJ7m28K\nnWyNUVH3tzF4IlSNq6SGDo4ll9Ph6dYKx30jcyAJaeki0pCpPaEoh/RyncJisuai\nfr+c+fDKwB0gLGTadlIPjFEs\n-----END PRIVATE KEY-----',  // -----BEGIN RSA PRIVATE KEY----- から始まる文字列
    SCOPE:          'bot',
  },

  // --- Dify ---
  DIFY: {
    API_BASE: 'https://p00-str001a.hinata-c.app/v1', // 例: https://api.dify.ai/v1
    API_KEY:  'app-SmnOvNWnruN4WJkSbOqoP1Eu',
    USER_ID:  'taiyo-yuka',
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
