import {
  AUTHOR_MEMOIR_AMAZON_URL,
  AUTHOR_MEMOIR_BOD_URL,
  AUTHOR_MEMOIR_EBOOK_URL,
  AUTHOR_MEMOIR_ISBN,
} from './constants';

describe('author book links', () => {
  it('uses verified BoD primary URL with ISBN', () => {
    expect(AUTHOR_MEMOIR_BOD_URL).toMatch(/^https:\/\/buchshop\.bod\.de\//);
    expect(AUTHOR_MEMOIR_BOD_URL).toContain('9783696754297');
    expect(AUTHOR_MEMOIR_ISBN).toBe('978-3-6967-5429-7');
  });

  it('keeps Amazon secondary and no ebook URL until verified', () => {
    expect(AUTHOR_MEMOIR_AMAZON_URL).toBe('https://www.amazon.de/dp/3696754293');
    expect(AUTHOR_MEMOIR_EBOOK_URL).toBeNull();
  });
});
