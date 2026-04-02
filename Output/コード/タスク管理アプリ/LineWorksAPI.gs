// ============================================================
// LineWorksAPI.gs — LINEワークスとの通信
// メッセージ送信・認証トークンの取得を担当する
// ============================================================

/**
 * テキストメッセージを送信する
 * @param {string}  text      - 送信するテキスト
 * @param {string}  target    - 送信先のチャンネルIDまたはユーザーID（省略時はCONFIGのCHANNEL_IDを使用）
 * @param {boolean} isChannel - true ならチャンネル宛、false ならユーザー宛
 */
function sendTextMessage(text, target = CONFIG.LINE_WORKS.CHANNEL_ID, isChannel = true) {
  const message = {
    content: {
      type: 'text',
      text: text,
    },
  };
  sendMessage(target, message, isChannel);
}

/**
 * ボタン付きの通知メッセージを送信する
 * ボタンが5つのため、2つのメッセージに分けて送信する
 * @param {string}  target    - 送信先のチャンネルIDまたはユーザーID
 * @param {string}  taskId    - タスクID
 * @param {string}  taskName  - タスク名
 * @param {string}  deadline  - 期限（YYYY-MM-DD）
 * @param {number}  daysLeft  - 残り日数
 * @param {boolean} isChannel - true ならチャンネル宛、false ならユーザー宛
 */
function sendTaskNotification(target, taskId, taskName, deadline, daysLeft, isChannel = true) {
  const daysText = daysLeft === 0 ? '今日が期限です！' : `あと ${daysLeft} 日`;

  // --- メッセージ1: タスク情報と進捗ボタン ---
  const message1 = {
    content: {
      type: 'button_template',
      contentText: `【期限のお知らせ】${taskName}\n期限：${deadline}（${daysText}）\n\n現在の進捗を教えてください。`,
      actions: [
        { type: 'message', label: '順調',    text: `on_track||${taskId}` },
        { type: 'message', label: '完了',    text: `complete||${taskId}` },
        { type: 'message', label: '問題発生', text: `issue||${taskId}` },
        { type: 'message', label: '中断',    text: `suspend||${taskId}` },
      ],
    },
  };

  // --- メッセージ2: 延期ボタン ---
  const message2 = {
    content: {
      type: 'button_template',
      contentText: '延期が必要な場合はボタンを押してください。',
      actions: [
        { type: 'message', label: '1日延期', text: `extend|1|${taskId}` },
        { type: 'message', label: '3日延期', text: `extend|3|${taskId}` },
        { type: 'message', label: '5日延期', text: `extend|5|${taskId}` },
      ],
    },
  };

  sendMessage(target, message1, isChannel);
  Utilities.sleep(500); // メッセージ順序を保つために少し待つ
  sendMessage(target, message2, isChannel);
}

/**
 * LINEワークスにメッセージを送信する（内部用）
 * @param {string} target    - 送信先のユーザーIDまたはチャンネルID
 * @param {Object} messageBody - メッセージ本文
 * @param {boolean} toChannel  - true の場合はチャンネル宛（/channels/）で送信
 */
function sendMessage(target, messageBody, toChannel = false) {
  const token = getAccessToken();
  const path  = toChannel
    ? `channels/${target}`
    : `users/${target}`;
  const url   = `${CONFIG.LINE_WORKS.API_BASE}/bots/${CONFIG.LINE_WORKS.BOT_ID}/${path}/messages`;

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
  const code = response.getResponseCode();
  if (code !== 200 && code !== 201) {
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
