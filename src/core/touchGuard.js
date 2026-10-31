// 모바일 스크롤 함정 방지.
// OrbitControls는 캔버스에 touch-action:none 을 걸어서, 손가락이 캔버스 위에 있으면 페이지가 스크롤되지 않는다.
// 터치 기기에서는 기본으로 조작을 끄고 "탭해서 조작" 오버레이를 보여 준다.
// 탭하면 조작 모드, 박스 밖을 탭하거나 데모가 화면에서 벗어나면 다시 스크롤 모드로 돌아간다.
import { isTouch } from './device.js';

export class TouchGuard {
  constructor(stage, onChange) {
    this.stage = stage;
    this.onChange = onChange;
    this.active = !isTouch;
    if (!isTouch) return;

    this.overlay = document.createElement('button');
    this.overlay.type = 'button';
    this.overlay.className = 'touch-guard';
    this.overlay.innerHTML = '<span>탭해서 조작</span>';
    this.overlay.addEventListener('click', () => this.set(true));

    this.exitBtn = document.createElement('button');
    this.exitBtn.type = 'button';
    this.exitBtn.className = 'touch-exit';
    this.exitBtn.textContent = '조작 끝내기 ✕';
    this.exitBtn.hidden = true;
    this.exitBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.set(false);
    });

    stage.append(this.overlay, this.exitBtn);

    this.onDocDown = (e) => {
      if (this.active && !stage.contains(e.target)) this.set(false);
    };
    document.addEventListener('pointerdown', this.onDocDown, { passive: true });
  }

  set(active) {
    if (!isTouch) return;
    this.active = active;
    this.overlay.hidden = active;
    this.exitBtn.hidden = !active;
    this.stage.classList.toggle('is-interactive', active);
    this.onChange?.(active);
  }

  dispose() {
    if (!isTouch) return;
    document.removeEventListener('pointerdown', this.onDocDown);
    this.overlay.remove();
    this.exitBtn.remove();
  }
}
