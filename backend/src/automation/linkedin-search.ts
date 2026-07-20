import { BrowserContext } from 'playwright';
import { shortDelay, randomDelay, humanScroll } from './human-delay';
import { detectCaptcha } from './linkedin-login';
import { logger } from '../config/logger';

export interface LeadProfile {
  name: string;
  headline: string;
  company: string;
  location: string;
  profileUrl: string;
  connectionDegree: string;
}

export function normalizeUrl(url: string): string {
  if (!url) return '';
  let cleaned = url.split('?')[0].trim();
  if (cleaned.endsWith('/')) {
    cleaned = cleaned.slice(0, -1);
  }
  return cleaned.toLowerCase();
}

export function cleanLinkedInName(name: string): string {
  if (!name) return '';
  let cleaned = name.replace(/\s+/g, ' ').trim();
  
  // Remove degree indicators, hiring/open badges
  cleaned = cleaned.replace(/\s*•\s*(1st|2nd|3rd\+?)$/i, '');
  cleaned = cleaned.replace(/\b(1st|2nd|3rd\+?)\b/gi, '');
  cleaned = cleaned.replace(/\b(is\s+)?hiring\b/gi, '');
  cleaned = cleaned.replace(/\b(is\s+)?open\s+to\s+work\b/gi, '');
  cleaned = cleaned.replace(/\b(Premium|Verified)\b/gi, '');
  cleaned = cleaned.replace(/[•·]/g, '').replace(/\s+/g, ' ').trim();

  // If the name is duplicated, e.g. "Ameet Sidhoe Ameet Sidhoe" or "Ameet SidhoeAmeet Sidhoe"
  const len = cleaned.length;
  for (let i = 1; i <= Math.floor(len / 2); i++) {
    const firstHalf = cleaned.slice(0, i).trim();
    const secondHalf = cleaned.slice(i).trim();
    if (firstHalf && firstHalf === secondHalf) {
      cleaned = firstHalf;
      break;
    }
  }
  return cleaned.trim();
}

export async function searchLinkedInPeople(
  context: BrowserContext,
  keywords: string[],
  location: string,
  maxResults: number,
  excludeUrls?: Set<string>,
  onCaptcha?: () => void
): Promise<LeadProfile[]> {
  const page = await context.newPage();
  const leads: LeadProfile[] = [];
  const keywordQuery = keywords.join(' ');

  try {
    const encodedKeyword = encodeURIComponent(keywordQuery);
    const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodedKeyword}&origin=SWITCH_SEARCH_VERTICAL&sid=abc`;
    
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await shortDelay(2000, 4000);

    let pageNum = 1;
    while (leads.length < maxResults && pageNum <= 10) {
      logger.info(`[Search] Page ${pageNum} — collected ${leads.length}/${maxResults} leads`);

      if (await detectCaptcha(page)) {
        logger.warn('[Search] CAPTCHA encountered — stopping');
        onCaptcha?.();
        break;
      }

      await humanScroll(page);
      await shortDelay(1500, 3000);

      // Wait for search result cards or no results indicator to load dynamically
      await page.waitForSelector('a[href*="/in/"], .search-no-results__image', { timeout: 10000 }).catch(() => {});

      const extractedLeads = await page.evaluate(() => {
        const section = Array.from(document.querySelectorAll('section'))
          .find(sec => {
            const links = Array.from(sec.querySelectorAll('a')).filter(a => (a as HTMLAnchorElement).href.includes('/in/') && !(a as HTMLAnchorElement).href.includes('/in/ACoAA'));
            return links.length > 0;
          });

        if (!section) return [];

        // Find all elements inside section
        const allElements = Array.from(section.querySelectorAll('*'));

        // Filter to elements that contain both a profile link and an action button
        const candidateContainers = allElements.filter(el => {
          const profileLinks = Array.from(el.querySelectorAll('a[href*="/in/"]'))
            .filter(a => !(a as HTMLAnchorElement).href.includes('/in/ACoAA'));
          if (profileLinks.length === 0) return false;

          const hasAction = Array.from(el.querySelectorAll('button, a, [role="button"]'))
            .some(btn => {
              const text = (btn.textContent || '').trim();
              return ['Connect', 'Message', 'Follow', 'Pending'].some(action => text.includes(action));
            });
          return hasAction;
        });

        // Keep only leaf candidate containers (no descendant should also be a candidate container)
        const trueCardContainers = candidateContainers.filter(candidate => {
          return !candidateContainers.some(other => {
            return other !== candidate && candidate.contains(other);
          });
        });

        return trueCardContainers.map((card) => {
          const cardText = (card.textContent || '').trim().replace(/\s+/g, ' ');

          // Find profile links inside the card
          const profileLinks = Array.from(card.querySelectorAll('a[href*="/in/"]'))
            .filter(a => !(a as HTMLAnchorElement).href.includes('/in/ACoAA'));
          const profileUrl = (profileLinks[0] ? profileLinks[0].getAttribute('href')?.split('?')[0] : '') || '';

          // Extract name
          let name = '';
          if (cardText.includes('•')) {
            name = cardText.split('•')[0].trim();
          } else if (profileLinks[0]) {
            const textEl = profileLinks[0].querySelector('div, span');
            name = textEl ? (textEl.textContent || '').trim() : (profileLinks[0].textContent || '').trim();
          }
          
          name = name.trim();
          if (name.includes(' is open to work')) {
            name = name.split(' is open to work')[0].trim();
          }

          // Clean name duplicate sequence
          const words = name.split(' ');
          if (words.length % 2 === 0) {
            const half = words.length / 2;
            const firstHalf = words.slice(0, half).join(' ');
            const secondHalf = words.slice(half).join(' ');
            if (firstHalf === secondHalf) {
              name = firstHalf;
            }
          }

          // Connection degree
          let degree = '3rd';
          if (cardText.includes('1st')) degree = '1st';
          else if (cardText.includes('2nd')) degree = '2nd';
          else if (cardText.includes('3rd')) degree = '3rd';

          // Extract headline & location from spans
          const spans = Array.from(card.querySelectorAll('span'))
            .map(span => (span.textContent || '').trim())
            .filter(t => t.length > 0);
          
          const cleanSpans = spans.filter(t => {
            return t !== name && 
                   !t.match(/^(1st|2nd|3rd\+?)$/) && 
                   !t.includes('•') && 
                   !['Connect', 'Message', 'Follow', 'Pending'].some(action => t.includes(action)) &&
                   !t.includes('is a mutual connection') &&
                   !t.includes('are mutual connections') &&
                   !t.includes('followers');
          });

          const headline = cleanSpans[0] || '';
          const location = cleanSpans[1] || '';

          return {
            name,
            headline,
            company: '',
            location,
            profileUrl,
            connectionDegree: degree
          };
        });
      });

      if (extractedLeads.length === 0) {
        logger.info('[Search] No more results on this page');
        break;
      }

      for (const lead of extractedLeads) {
        if (leads.length >= maxResults) break;
        if (!lead.profileUrl) continue;
        const cleanedName = cleanLinkedInName(lead.name);
        if (cleanedName.toLowerCase().includes('linkedin member')) continue;

        const normUrl = normalizeUrl(lead.profileUrl);
        if (excludeUrls && excludeUrls.has(normUrl)) {
          logger.info(`[Search] Skipping already actioned lead in search: ${cleanedName} (${lead.profileUrl})`);
          continue;
        }

        // Avoid duplicates in the current search run
        if (leads.some((l) => normalizeUrl(l.profileUrl) === normUrl)) continue;
        
        leads.push({
          name: cleanedName,
          headline: lead.headline,
          company: lead.company,
          location: lead.location,
          profileUrl: lead.profileUrl,
          connectionDegree: lead.connectionDegree
        });
      }

      // Paginate using specific pagination selectors
      const nextBtn = page.locator('button[aria-label="Next"], button[data-testid="pagination-controls-next-button-visible"], .artdeco-pagination__button--next, button.artdeco-pagination__button--next').first();
      const isNextEnabled = await nextBtn.isEnabled({ timeout: 2000 }).catch(() => false);
      if (isNextEnabled && leads.length < maxResults) {
        await nextBtn.scrollIntoViewIfNeeded().catch(() => {});
        await nextBtn.click({ force: true });
        await randomDelay(8000, 15000); // Delay between search pages
        pageNum++;
      } else {
        break;
      }
    }

    logger.info(`[Search] Complete — found ${leads.length} leads`);
    return leads;
  } catch (err) {
    logger.error('[Search] Search failed:', err);
    return leads;
  } finally {
    await page.close();
  }
}

export async function visitProfileAndExtract(context: BrowserContext, profileUrl: string): Promise<Partial<LeadProfile>> {
  const page = await context.newPage();
  try {
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await shortDelay(2000, 3500);
    await humanScroll(page);

    const company = await page
      .locator('.pv-text-details__right-panel .inline-show-more-text, [data-field="experience_company_name"]')
      .first()
      .innerText()
      .catch(() => '');

    return { company: company.trim() };
  } catch {
    return {};
  } finally {
    await page.close();
  }
}
