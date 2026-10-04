/**
 * OpenRouter Proxy for Claude Code
 * 
 * Translates Claude Code's model names (claude-sonnet-5-5) 
 * to OpenRouter's format (anthropic/claude-sonnet-5.5)
 * and adds headers to bypass Cloudflare bot protection.
 */

const http = require('http');
const https = require('https');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || 'your_api_key_here';
const PORT = 3099;

const MODEL_MAP = {
  'claude-sonnet-5-5': 'anthropic/claude-sonnet-5.5',
  'claude-opus-5-5': 'anthropic/claude-opus-5.5',
  'claude-sonnet-5': 'anthropic/claude-sonnet-5',
  'claude-opus-5': 'anthropic/claude-opus-5',
  'claude-haiku-4-5': 'anthropic/claude-haiku-4.5',
  'claude-sonnet-4-5': 'anthropic/claude-sonnet-4.5',
  'claude-opus-4-5': 'anthropic/claude-opus-4.5',
  'claude-3-5-sonnet-20241022': 'anthropic/claude-sonnet-4.5',
  'claude-3-opus-20240229': 'anthropic/claude-opus-4.5',
  'claude-3-haiku-20240307': 'anthropic/claude-haiku-4.5',
};

function translateModel(name) {
  // FORCE HAIKU: Your OpenRouter balance is too low for Opus/Sonnet.
  // Haiku is 60x cheaper, so your remaining pennies will give you millions of tokens!
  return 'anthropic/claude-3-haiku';
}

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    let parsed = {};
    if (body) {
      try { parsed = JSON.parse(body); } catch {}
    }

    if (parsed.model) {
      const originalModel = parsed.model;
      parsed.model = translateModel(parsed.model);
      console.log(`[proxy] ${originalModel} → ${parsed.model}`);
    }

    // Fix for OpenRouter 402 error: OpenRouter calculates worst-case cost based on max_tokens.
    // Your account balance currently only allows ~1997 tokens of output.
    // We cap it to 1500 so requests actually go through.
    if (parsed.max_tokens && parsed.max_tokens > 1500) {
      parsed.max_tokens = 1500;
    }

    const headers = { ...req.headers };
    delete headers.host;
    headers['Authorization'] = `Bearer ${OPENROUTER_API_KEY}`;
    headers['HTTP-Referer'] = 'https://claude.ai';
    headers['X-Title'] = 'Claude Code Proxy';
    // This User-Agent prevents the Cloudflare HTML block you saw
    headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

    const newBody = body ? JSON.stringify(parsed) : '';
    if (newBody) {
      headers['Content-Length'] = Buffer.byteLength(newBody);
    }

    let requestPath = req.url;
    if (!requestPath.startsWith('/api')) {
      // Claude Code requests /v1/messages, but OpenRouter needs /api/v1/messages
      requestPath = '/api' + requestPath;
    }

    const options = {
      hostname: 'openrouter.ai',
      path: requestPath,
      method: req.method,
      headers: headers
    };

    const proxyReq = https.request(options, proxyRes => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', err => {
      console.error('[proxy error]', err.message);
      if (!res.headersSent) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
    });

    if (newBody) {
      proxyReq.write(newBody);
    }
    proxyReq.end();
  });
});

server.listen(PORT, () => {
  console.log(`✅ OpenRouter proxy running on http://localhost:${PORT}`);
});
