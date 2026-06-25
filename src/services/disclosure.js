'use strict';

/**
 * Korean FTC (공정거래위원회) compliant disclosure notices.
 * Returns HTML blocks to be inserted at the top (and/or bottom) of a post.
 *
 * kind:
 *   'none'              — no notice
 *   'self_purchase'     — bloggers's own purchase ("내돈내산")
 *   'sponsored'         — paid/sponsored review
 *   'coupang_affiliate' — Coupang Partners affiliate links present
 */

const NOTICES = {
  none: null,
  self_purchase: `<p style="padding:10px 14px;background:#f0fdf4;border-left:3px solid #10b981;color:#065f46;font-size:14px;border-radius:6px;margin:12px 0;">
✅ <strong>내돈내산 후기</strong> · 본 포스팅은 직접 구매한 제품에 대한 솔직한 사용 후기입니다.
</p>`,
  sponsored: `<p style="padding:10px 14px;background:#fef3c7;border-left:3px solid #f59e0b;color:#78350f;font-size:14px;border-radius:6px;margin:12px 0;">
🤝 <strong>유료 광고 포함</strong> · 본 포스팅은 ○○으로부터 제품(또는 원고료)을 제공받아 작성되었습니다. 솔직한 사용감을 바탕으로 작성하였습니다.
</p>`,
  coupang_affiliate: `<p style="padding:10px 14px;background:#fef3c7;border-left:3px solid #f59e0b;color:#78350f;font-size:14px;border-radius:6px;margin:12px 0;">
🛒 <strong>쿠팡 파트너스 활동 안내</strong> · 본 포스팅은 쿠팡파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
</p>`,
  naver_shopping_connect: `<p style="text-align:center;padding:10px 14px;background:#f0f9ff;border-left:3px solid #0ea5e9;color:#0c4a6e;font-size:14px;border-radius:6px;margin:12px 0;">
"이 포스팅은 네이버 쇼핑 커넥트 활동의 일환으로, 판매 발생 시 수수료를 제공받습니다."
</p>`,
};

/** Returns the HTML notice block (or empty string). */
function disclosureHtml(kind) {
  return NOTICES[kind] || '';
}

/**
 * Determine the effective disclosure kind given:
 * - user-selected `disclosureKind`
 * - whether the post contains any Coupang affiliate links
 * Selection precedence: sponsored > coupang_affiliate > self_purchase > none.
 */
function resolveDisclosure(disclosureKind, hasCoupangLinks) {
  if (disclosureKind === 'sponsored') return 'sponsored';
  if (disclosureKind === 'naver_shopping_connect') return 'naver_shopping_connect';
  if (hasCoupangLinks) return 'coupang_affiliate';
  if (disclosureKind === 'self_purchase') return 'self_purchase';
  return 'none';
}

/** True when the kind requires a notice but it's missing from the body. */
function isMissingDisclosure(kind, contentHtml) {
  if (kind === 'none') return false;
  const probes = {
    self_purchase: '내돈내산',
    sponsored: '유료 광고',
    coupang_affiliate: '쿠팡파트너스',
    naver_shopping_connect: '쇼핑 커넥트',
  };
  const needle = probes[kind];
  return needle ? !String(contentHtml || '').includes(needle) : false;
}

module.exports = { disclosureHtml, resolveDisclosure, isMissingDisclosure };
