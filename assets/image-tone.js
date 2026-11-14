/*
  Picks a black or white heart for every product card, from the pixels actually under it.

  Liquid cannot know how dark an image is, so this runs in the browser once the image
  (or a video's poster or current frame) is ready: it maps the heart's box onto the
  image the way object-fit: cover and the focal point crop it, averages a few pixels
  there, and chooses whichever of white or black has the better contrast ratio
  (white wins below a relative luminance of 0.179). The result is data-heart="white" or
  "black" on the button, which base.css turns into a color. Without JavaScript, or when
  the pixels cannot be read, the heart keeps the theme foreground color and its halo.
*/
const SIZE = 6;
const canvas = document.createElement('canvas');
canvas.width = canvas.height = SIZE;
const context = canvas.getContext('2d', { willReadFrequently: true });

const linear = (value) => ((value /= 255) <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);

const measure = (media, button) => {
  const width = media.naturalWidth || media.videoWidth;
  const height = media.naturalHeight || media.videoHeight;
  if (!width || !height) return;
  const box = media.getBoundingClientRect();
  const spot = button.getBoundingClientRect();
  if (!box.width || !spot.width) return;
  const [x = 50, y = 50] = getComputedStyle(media).objectPosition.split(' ').map(parseFloat);
  const scale = Math.max(box.width / width, box.height / height);
  const left = (box.width - width * scale) * (x / 100);
  const top = (box.height - height * scale) * (y / 100);
  const half = 10;
  const centerX = spot.left + spot.width / 2 - box.left;
  const centerY = spot.top + spot.height / 2 - box.top;
  try {
    context.drawImage(media, (centerX - half - left) / scale, (centerY - half - top) / scale, (half * 2) / scale, (half * 2) / scale, 0, 0, SIZE, SIZE);
    const { data } = context.getImageData(0, 0, SIZE, SIZE);
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) sum += 0.2126 * linear(data[i]) + 0.7152 * linear(data[i + 1]) + 0.0722 * linear(data[i + 2]);
    button.dataset.heart = sum / (SIZE * SIZE) < 0.179 ? 'white' : 'black';
  } catch {}
};

const ready = (media) => (media.localName === 'video' ? media.readyState >= 2 : media.complete && media.naturalWidth);

const observer = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    observer.unobserve(entry.target);
    const media = entry.target.parentElement?.querySelector(':scope > img, :scope > video');
    if (!media) continue;
    if (ready(media)) measure(media, entry.target);
    else media.addEventListener(media.localName === 'video' ? 'loadeddata' : 'load', () => measure(media, entry.target), { once: true });
  }
}, { rootMargin: '200px' });

const seen = new WeakSet();
const scan = () => {
  for (const button of document.querySelectorAll('.product-card > .wishlist-heart')) {
    if (seen.has(button)) continue;
    seen.add(button);
    observer.observe(button);
  }
};

let queued = false;
new MutationObserver(() => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    scan();
  });
}).observe(document.getElementById('main') ?? document.body, { childList: true, subtree: true });
scan();
