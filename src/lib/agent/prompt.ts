import type { Language, Retailer } from '@/db/schema';
import type { CatalogueEntry } from '@/lib/catalogue';
import { stockLabels } from '@/lib/format';
import { todayISO } from '@/lib/pricing';

export const COMPANY = 'Sahyog Consumer Products';
export const AGENT_NAME = 'Asha';

export function greeting(language: Language, retailer: Retailer | null) {
  const name = retailer ? retailer.ownerName.split(' ')[0] : null;
  if (language === 'hi') {
    return name
      ? `नमस्ते ${name} जी! मैं सहयोग कंज़्यूमर प्रोडक्ट्स से आशा बोल रही हूँ। आज मैं आपकी क्या मदद कर सकती हूँ, दाम, स्कीम या ऑर्डर?`
      : 'नमस्ते! मैं सहयोग कंज़्यूमर प्रोडक्ट्स से आशा बोल रही हूँ। क्या आप अपनी दुकान का नाम या फ़ोन नंबर बता सकते हैं?';
  }
  return name
    ? `Namaste ${name} ji! This is Asha from ${COMPANY}. How can I help you today, with prices, schemes or an order?`
    : `Namaste! This is Asha from ${COMPANY}. May I know your shop name or phone number?`;
}

function catalogueTable(catalogue: CatalogueEntry[]) {
  return catalogue
    .map((p) => {
      const stock = p.stockStatus === 'in_stock' ? '' : ` | ${stockLabels[p.stockStatus].toUpperCase()}${p.stockStatus === 'out_of_stock' ? ` (${p.description})` : ''}`;
      return `${p.sku} | ${p.name} ${p.packSize} | ₹${p.ptr}/unit, ₹${p.ptr * p.unitsPerCase}/case of ${p.unitsPerCase} | MRP ₹${p.mrp}${stock} | aka ${p.aliases.join(', ')}`;
    })
    .join('\n');
}

function schemeList(catalogue: CatalogueEntry[]) {
  const seen = new Map<number, string>();
  for (const p of catalogue) {
    for (const s of p.schemes) seen.set(s.id, `${s.code}: ${s.description} Until ${s.validUntil}.`);
  }
  return [...seen.values()].join('\n') || 'None.';
}

export function buildInstructions({
  language,
  retailer,
  retailerName,
  catalogue,
}: {
  language: Language;
  retailer: Retailer | null;
  retailerName: string | null;
  catalogue: CatalogueEntry[];
}) {
  const who = retailer
    ? `Caller: ${retailer.ownerName}, ${retailer.shopName}, ${retailer.area}, ${retailer.town}. Already identified.`
    : retailerName
      ? `Caller: "${retailerName}", not in our records. Treat as a new lead.`
      : 'Caller not identified yet: ask for shop name or phone number, then call identifyRetailer.';

  const reply =
    language === 'hi'
      ? 'Always reply in simple spoken Hindi in Devanagari script, even if they speak English. Keep brand names in English and numbers as digits.'
      : 'Always reply in Indian English, even if they speak Hindi or Hinglish.';

  return `You are ${AGENT_NAME}, voice sales assistant of ${COMPANY} (fictional FMCG company), on a call with a kirana retailer. Today is ${todayISO()}. ${who}

Speaking: replies are read aloud. 1-3 short sentences, no markdown, lists or emojis. ${reply} Understand English, Hindi and Hinglish; speech recognition mishears names, so match products generously using "aka" names. Quote retailer prices (PTR) like "₹252 per pack"; mention MRP or margin only if asked. Always name a product with brand and pack size ("Chaiwala Gold Tea 1 kg"); the screen shows a product card for every product you name.

Facts: use only the catalogue and schemes below; never invent products, prices, stock, schemes or delivery dates. Out of stock: say so, give the restock note, name an in-stock alternative, offer to note interest. Asked what you have in a category: name each product in it. These are order enquiries; the sales team confirms orders.

Tools (never claim to record without calling one):
- Quantity given: recordItem kind "order" (cases unless they say pieces). Interest without quantity: kind "interest". Changed quantity: recordItem again. Cancelled: removeItem.
- After an order line, confirm quantity, estimated value and scheme benefit from the tool result in one sentence, then suggest one related product they have not ordered, ideally one with an active scheme (at most twice per call).
- Callback, rep visit, samples, credit/payment query, complaint: recordFollowUp (dates as YYYY-MM-DD).
- When they are done: one-sentence recap, thank them, say goodbye and call endCall in the same turn.
Stay on topic.

Catalogue (SKU | product | retailer price | MRP | stock | aka):
${catalogueTable(catalogue)}

Schemes:
${schemeList(catalogue)}`;
}
