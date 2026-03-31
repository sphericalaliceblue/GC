// ============================================================
// LineWorksAPI.gs — LINEワークスとの通信
// メッセージ送信・認証トークンの取得を担当する
// ============================================================

/**
 * テキストメッセージを送信する
 * @param {string} userId - 送信先のユーザーID
 * @param {string} text   - 送信するテキスト
 */
function sendTextMessage(userId, text) {
  const message = {
    content: {
      type: 'text',
      text: text,
    },
  };
  sendMessage(userId, message);
}

/**
 * ボタン付きの通知メッセージを送信する
 * ボタンが5つのため、2つのメッセージに分けて送信する
 * @param {string} userId    - 送信先のユーザーID
 * @param {string} taskId    - タスクID
 * @param {string} taskName  - タスク名
 * @param {string} deadline  - 期限（YYYY-MM-DD）
 * @param {number} daysLeft  - 残り日数
 */
function sendTaskNotification(userId, taskId, taskName, deadline, daysLeft) {
  // --- メッセージ1: タスク情報と延期ボタン ---
  const daysText = daysLeft === 0 ? '今日が期限です！' : `あと ${daysLeft} 日`;
  const message1 = {
    content: {
      type: 'button_template',
      altText: `【期限のお知らせ】${taskName}`,
      template: {
        type: 'buttons',
        text: `📋 ${taskName}\n📅 期限：${deadline}（${daysText}）\n\n延期が必要な場合はボタンを押してください。`,
        actions: [
          { type: 'postback', label: '1日延期', data: `extend|1|${taskId}` },
          { type: 'postback', label: '3日延期', data: `extend|3|${taskId}` },
          { type: 'postback', label: '5日延期', data: `extend|5|${taskId}` },
        ],
      },
    },
  };

  // --- メッセージ2: 進捗ボタン ---
  const message2 = {
    content: {
      type: 'button_template',
      altText: '進捗を教えてください',
      template: {
        type: 'buttons',
        text: '現在の進捗を教えてください。',
        actions: [
          { type: 'postback', label: '✅ 順調', data: `on_track||${taskId}` },
          { type: 'postback', label: '🎉 完了', data: `complete||${taskId}` },
        ],
      },
    },
  };

  sendMessage(userId, message1);
  Utilities.sleep(500); // メッセージ順序を保つために少し待つ
  sendMessage(userId, message2);
}

/**
 * LINEワークスにメッセージを送信する（内部用）
 */
function sendMessage(userId, messageBody) {
  const token = getAccessToken();
  const url   = `${CONFIG.LINE_WORKS.API_BASE}/bots/${CONFIG.LINE_WORKS.BOT_ID}/users/${userId}/messages`;

  const options = {
    method:             'POST',
    headers: {
      'Authorization':  `Bearer ${token}`,
      'Content-Type':   'application/json',
    },
    payload:            JSON.stringify(messageBody),
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode() !== 200) {
    console.error('メッセージ送信エラー:', response.getContentText());
  }
}

/**
 * LINEワークスの認証トークンを取得する
 * 一度取得したトークンは約1時間キャッシュして再利用する
 */
function getAccessToken() {
  const cache  = CacheService.getScriptCache();
  const cached = cache.get('lw_access_token');
  if (cached) return cached;

  const jwt   = createJWT();
  const token = fetchAccessToken(jwt);

  cache.put('lw_access_token', token, 3500); // 約58分キャッシュ
  return token;
}

/**
 * JWT（認証用の暗号化された証明書）を作成する（内部用）
 */
function createJWT() {
  const now = Math.floor(Date.now() / 1000);

  const header  = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: CONFIG.LINE_WORKS.CLIENT_ID,
    sub: CONFIG.LINE_WORKS.SERVICE_ACCOUNT,
    iat: now,
    exp: now + 3600,
  };

  const encode = (obj) =>
    Utilities.base64EncodeWebSafe(JSON.stringify(obj)).replace(/=/g, '');

  const headerB64  = encode(header);
  const payloadB64 = encode(payload);
  const signingInput = `${headerB64}.${payloadB64}`;

  const signature    = Utilities.computeRsaSha256Signature(signingInput, CONFIG.LINE_WORKS.PRIVATE_KEY);
  const signatureB64 = Utilities.base64EncodeWebSafe(signature).replace(/=/g, '');

  return `${signingInput}.${signatureB64}`;
}

/**
 * JWTを使ってアクセストークンを取得する（内部用）
 */
function fetchAccessToken(jwt) {
  const response = UrlFetchApp.fetch(CONFIG.LINE_WORKS.AUTH_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    payload: {
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion:  jwt,
      client_id:  CONFIG.LINE_WORKS.CLIENT_ID,
      client_secret: CONFIG.LINE_WORKS.CLIENT_SECRET,
      scope:      CONFIG.LINE_WORKS.SCOPE,
    },
  });

  const result = JSON.parse(response.getContentText());
  if (!result.access_token) {
    throw new Error('トークン取得失敗: ' + response.getContentText());
  }
  return result.access_token;
}
