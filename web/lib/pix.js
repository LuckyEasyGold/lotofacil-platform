/**
 * lib/pix.js — Geração de PIX ESTÁTICO (BR Code EMV QRCPS-MPM).
 *
 * Portado do whodo-next (src/lib/clients/pix-mcp.ts) — implementação própria,
 * SEM depender de gateway externo: monta o payload EMV (TLV), calcula o
 * CRC-16/CCITT-FALSE e gera a imagem do QR via QR Server (fallback: vazio —
 * o app mostra o copia-e-cola mesmo sem imagem).
 *
 * Fluxo de depósito (modelo whodo-next):
 *   1. Usuário solicita depósito → cria cobrança PIX (status pending)
 *   2. Usuário paga via QR / copia-e-cola no app do banco
 *   3. Admin confirma manualmente → saldo é creditado
 *
 * Configuração via .env:
 *   PIX_KEY   — chave PIX que RECEBE os depósitos (CPF/CNPJ/e-mail/celular)
 *   PIX_NAME  — nome do recebedor (máx. 25 chars no payload)
 *   PIX_CITY  — cidade do recebedor (máx. 15 chars no payload)
 */

const PIX_KEY = (process.env.PIX_KEY || '67229517000128').trim();
const PIX_NAME = (process.env.PIX_NAME || 'Lotofacil Platform').substring(0, 25);
const PIX_CITY = (process.env.PIX_CITY || 'SAO PAULO').substring(0, 15).toUpperCase();

/**
 * Formata um campo TLV (Tag-Length-Value) do payload EMV PIX.
 */
function tlv(id, value) {
  const len = String(value.length).padStart(2, '0');
  return `${id}${len}${value}`;
}

/**
 * Calcula o CRC-16/CCITT-FALSE do payload PIX.
 */
function crc16(data) {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    }
  }
  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Gera o payload EMV BR Code para PIX estático.
 * @param {string} chavePix Chave PIX do recebedor (CPF, CNPJ, email, celular ou aleatória)
 * @param {number} valor    Valor em reais (ex: 99.90). Se 0, gera sem valor fixo.
 * @param {string} nome     Nome do recebedor (máx. 25 chars)
 * @param {string} cidade   Cidade do recebedor (máx. 15 chars)
 * @param {string} txid     Identificador da transação (máx. 25 chars, apenas alfanumérico)
 */
function gerarPayloadPix(chavePix, valor, nome, cidade, txid = '***') {
  // ID 00 — Payload Format Indicator
  const payloadFormat = tlv('00', '01');

  // ID 26 — Merchant Account Information (PIX)
  const gui = tlv('00', 'BR.GOV.BCB.PIX');
  const chave = tlv('01', chavePix);
  const merchantAccountInfo = tlv('26', gui + chave);

  // ID 52 — Merchant Category Code
  const mcc = tlv('52', '0000');

  // ID 53 — Transaction Currency (BRL = 986)
  const currency = tlv('53', '986');

  // ID 54 — Transaction Amount (opcional, apenas se valor > 0)
  const valorStr = valor > 0 ? tlv('54', valor.toFixed(2)) : '';

  // ID 58 — Country Code
  const country = tlv('58', 'BR');

  // ID 59 — Merchant Name (máx. 25 chars)
  const merchantName = tlv('59', String(nome).substring(0, 25));

  // ID 60 — Merchant City (máx. 15 chars)
  const merchantCity = tlv('60', String(cidade).substring(0, 15).toUpperCase());

  // ID 62 — Additional Data Field Template
  const txidField = tlv(
    '05',
    String(txid)
      .substring(0, 25)
      .replace(/[^a-zA-Z0-9]/g, '')
      .padEnd(3, '*') || '***'
  );
  const additionalData = tlv('62', txidField);

  // Montar payload sem CRC (ID 63)
  const payloadSemCrc =
    payloadFormat +
    merchantAccountInfo +
    mcc +
    currency +
    valorStr +
    country +
    merchantName +
    merchantCity +
    additionalData +
    '6304';

  return payloadSemCrc + crc16(payloadSemCrc);
}

/**
 * Gera uma imagem QR Code como base64 data URL usando a API do QR Server.
 * Fallback: string vazia — o frontend exibe o copia-e-cola mesmo sem imagem.
 */
async function gerarQrCodeBase64(pixCode) {
  // Em testes/CI evita chamada externa (a cobrança continua válida, só sem a
  // imagem base64). Configure PIX_QR_DISABLED=1 no ambiente de teste.
  if (process.env.PIX_QR_DISABLED === '1') return '';
  try {
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixCode)}&format=png`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error('QR Server indisponível');
    const buffer = await res.arrayBuffer();
    return Buffer.from(buffer).toString('base64');
  } catch {
    return '';
  }
}

/**
 * Gera uma cobrança PIX estática para a conta da plataforma.
 * @param {number} valorCentavos Valor em centavos (ex: 9990 = R$ 99,90)
 * @param {string} [_descricao]  Ignorado na versão estática
 * @param {string} [chavePix]    Chave PIX alternativa (padrão: PIX_KEY do .env)
 */
async function gerarPix(valorCentavos, _descricao, chavePix) {
  const chave = chavePix || PIX_KEY;
  const valor = Number((Number(valorCentavos) / 100).toFixed(2));
  const txid = `LF${Date.now().toString(36).toUpperCase().slice(-8)}`;

  const pixCode = gerarPayloadPix(chave, valor, PIX_NAME, PIX_CITY, txid);
  const qrBase64 = await gerarQrCodeBase64(pixCode);

  return {
    qr_code: pixCode,
    qr_code_base64: qrBase64,
    txid,
    beneficiario: { chavePix: chave, nome: PIX_NAME, cidade: PIX_CITY }
  };
}

module.exports = { gerarPix, gerarPayloadPix, crc16, tlv, PIX_KEY, PIX_NAME, PIX_CITY };
