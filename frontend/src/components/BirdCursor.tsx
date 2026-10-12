import { useEffect, useRef } from 'react';
import './birdCursor.css';

/** 부리 끝(그림 안 좌표)이 실제 마우스 위치에 오도록 맞춘다. 오른쪽으로 날 땐 그림을 뒤집으므로 x가 반대편이다. */
const BEAK_X = 1;
const BEAK_X_FLIPPED = 30;
const BEAK_Y = 8;
/** 이만큼 멈춰 있으면 날갯짓을 멈추고 앉는다(ms) */
const PERCH_AFTER = 140;

/** 글자를 쓰는 칸 위에서는 새를 숨기고 원래 글자 커서를 보여 준다 */
const TEXT_ENTRY =
  "input:not([type='checkbox'], [type='radio'], [type='range'], [type='file'], [type='color'], [type='button'], [type='submit'], [type='reset']), textarea, [contenteditable='true'], [contenteditable='true'] *";

/**
 * 마우스 커서 대신 따라다니는 픽셀 참새. 움직이는 동안 날갯짓하고 멈추면 앉고, 누르면 한 번 쪼는다.
 * 마우스가 있는 기기에서만 켠다(휴대폰·태블릿 터치는 그대로). 그림은 public/cursor-bird-sheet.png(앉음·날개 위·날개 아래 3칸).
 */
export default function BirdCursor() {
  const birdRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bird = birdRef.current;
    if (!bird || typeof window.matchMedia !== 'function') return;
    if (!window.matchMedia('(pointer: fine)').matches) return;

    const root = document.documentElement;
    root.classList.add('bird-cursor');

    let x = 0;
    let y = 0;
    let lastX: number | null = null;
    let flipped = false;
    let frame = 0;
    let perchTimer = 0;

    const draw = () => {
      frame = 0;
      const left = x - (flipped ? BEAK_X_FLIPPED : BEAK_X);
      bird.style.transform = `translate(${left}px, ${y - BEAK_Y}px)${flipped ? ' scaleX(-1)' : ''}`;
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') {
        bird.dataset.state = 'hidden';
        return;
      }
      x = event.clientX;
      y = event.clientY;
      if (lastX !== null) {
        const dx = x - lastX;
        // 손 떨림에 이리저리 뒤집히지 않게 조금 이상 움직였을 때만 방향을 바꾼다
        if (dx > 2) flipped = true;
        else if (dx < -2) flipped = false;
      }
      lastX = x;
      const overText = event.target instanceof Element && event.target.closest(TEXT_ENTRY) !== null;
      bird.dataset.state = overText ? 'hidden' : 'flying';
      window.clearTimeout(perchTimer);
      perchTimer = window.setTimeout(() => {
        if (bird.dataset.state === 'flying') bird.dataset.state = 'perched';
      }, PERCH_AFTER);
      if (!frame) frame = window.requestAnimationFrame(draw);
    };

    const onDown = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      // 같은 쪼기를 다시 시작하려면 한 번 지웠다가 다음 그림에 다시 붙인다
      delete bird.dataset.peck;
      void bird.offsetWidth;
      bird.dataset.peck = 'true';
    };
    const onPeckEnd = () => {
      delete bird.dataset.peck;
    };

    const onLeave = (event: MouseEvent) => {
      if (!event.relatedTarget) bird.dataset.state = 'hidden';
    };

    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerdown', onDown, { passive: true });
    document.addEventListener('mouseout', onLeave);
    bird.addEventListener('animationend', onPeckEnd);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      bird.removeEventListener('animationend', onPeckEnd);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('mouseout', onLeave);
      window.clearTimeout(perchTimer);
      if (frame) window.cancelAnimationFrame(frame);
      root.classList.remove('bird-cursor');
    };
  }, []);

  return (
    <div ref={birdRef} className="bird-cursor-sprite" data-state="hidden" aria-hidden="true">
      <div className="bird-cursor-body" />
    </div>
  );
}
