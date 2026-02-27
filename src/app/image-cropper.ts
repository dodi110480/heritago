import {
  Component,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
  AfterViewInit,
  HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-image-cropper',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="overlay" (click)="cancel.emit()">
      <div class="modal" (click)="$event.stopPropagation()">

        <div class="modal-header">
          <h3>Bild zuschneiden</h3>
          <div class="actions">
            <button class="btn secondary" (click)="setAspect('free')">Frei</button>
            <button class="btn secondary" (click)="setAspect(1)">1:1</button>
            <button class="btn secondary" (click)="useFullImage()">Ganzes Bild</button>
          </div>
        </div>

        <div class="modal-body">
          <canvas #canvas
            (pointerdown)="onPointerDown($event)"
            (pointermove)="onPointerMove($event)"
            (pointerup)="onPointerUp()"
            (pointerleave)="onPointerUp()"
            (wheel)="onWheel($event)"
          ></canvas>
        </div>

        <div class="modal-footer">
          <button class="btn secondary" (click)="cancel.emit()">Abbrechen</button>
          <button class="btn primary" (click)="crop()">Übernehmen</button>
        </div>

      </div>
    </div>
  `,
  styles: [`
    :host { font-family: Inter, system-ui, sans-serif; }

    .overlay {
      position: fixed; inset: 0;
      background: rgba(15,23,42,0.8);
      backdrop-filter: blur(8px);
      display: flex; align-items: center; justify-content: center;
      z-index: 3000;
    }

    .modal {
      width: 90vw;
      max-width: 1200px;
      height: 85vh;
      background: #ffffff;
      border-radius: 28px;
      display: flex;
      flex-direction: column;
      box-shadow: 0 40px 80px rgba(0,0,0,0.35);
      overflow: hidden;
    }

    .modal-header,
    .modal-footer {
      padding: 24px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
    }

    .modal-footer {
      border-top: 1px solid #e2e8f0;
      border-bottom: none;
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }

    .modal-body {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      background: radial-gradient(circle at center, #1e293b, #0f172a);
      overflow: hidden;
    }

    canvas {
      max-width: 100%;
      max-height: 100%;
      touch-action: none;
      border-radius: 12px;
    }

    .btn {
      padding: 10px 16px;
      border-radius: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: 0.2s ease;
      border: none;
    }

    .btn.primary {
      background: #3b82f6;
      color: white;
    }
    .btn.primary:hover {
      background: #2563eb;
    }

    .btn.secondary {
      background: white;
      border: 1px solid #cbd5e1;
      color: #1e293b;
    }
    .btn.secondary:hover {
      background: #f1f5f9;
    }

    h3 {
      margin: 0;
      font-weight: 700;
      color: #334155;
    }

    .actions {
      display: flex;
      gap: 8px;
      margin-top: 12px;
    }
  `]
})
export class ImageCropper implements AfterViewInit {

  @Input() imageUrl!: string;
  @Input() aspect: number | 'free' = 'free';
  @Output() cropped = new EventEmitter<Blob>();
  @Output() cancel = new EventEmitter<void>();

  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private ctx!: CanvasRenderingContext2D;
  private img = new Image();

  private scale = 1;
  private zoom = 1;

  private rect = { x: 100, y: 100, w: 300, h: 300 };
  private dragging = false;
  private resizing = false;
  private resizeCorner: 'nw' | 'ne' | 'sw' | 'se' | null = null;

  private minSize = 80;

  ngAfterViewInit() {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;

    this.img.src = this.imageUrl;
    this.img.onload = () => this.initCanvas();
  }

  private initCanvas() {
    const canvas = this.canvasRef.nativeElement;
    const dpr = window.devicePixelRatio || 1;

    const maxW = canvas.parentElement!.clientWidth;
    const maxH = canvas.parentElement!.clientHeight;

    const ratio = Math.min(
      maxW / this.img.width,
      maxH / this.img.height
    );

    canvas.width = this.img.width * ratio * dpr;
    canvas.height = this.img.height * ratio * dpr;
    canvas.style.width = `${this.img.width * ratio}px`;
    canvas.style.height = `${this.img.height * ratio}px`;

    this.ctx.scale(dpr, dpr);
    this.scale = ratio;

    this.draw();
  }

  setAspect(a: number | 'free') {
    this.aspect = a;
    if (a !== 'free') {
      this.rect.h = this.rect.w / a;
    }
    this.draw();
  }

  useFullImage() {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    this.rect = { x: 0, y: 0, w, h };
    this.draw();
  }

  private draw() {
    const canvas = this.canvasRef.nativeElement;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);

    ctx.drawImage(this.img, 0, 0, w, h);

    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, w, h);

    ctx.clearRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h);
    ctx.drawImage(
      this.img,
      this.rect.x / w * this.img.width,
      this.rect.y / h * this.img.height,
      this.rect.w / w * this.img.width,
      this.rect.h / h * this.img.height,
      this.rect.x,
      this.rect.y,
      this.rect.w,
      this.rect.h
    );

    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.strokeRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h);

    this.drawHandles();
  }

  private drawHandles() {
    const ctx = this.ctx;
    const s = 10;
    const { x, y, w, h } = this.rect;

    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(x - s / 2, y - s / 2, s, s);
    ctx.fillRect(x + w - s / 2, y - s / 2, s, s);
    ctx.fillRect(x - s / 2, y + h - s / 2, s, s);
    ctx.fillRect(x + w - s / 2, y + h - s / 2, s, s);
  }

  onPointerDown(e: PointerEvent) {
    const pos = this.getPos(e);

    if (this.hitCorner(pos)) {
      this.resizing = true;
    } else if (this.inRect(pos)) {
      this.dragging = true;
    }
  }

  onPointerMove(e: PointerEvent) {
    const pos = this.getPos(e);

    if (this.dragging) {
      this.rect.x = pos.x - this.rect.w / 2;
      this.rect.y = pos.y - this.rect.h / 2;
      this.constrain();
      this.draw();
    }

    if (this.resizing && this.resizeCorner) {
      const dx = pos.x - this.rect.x;
      const dy = pos.y - this.rect.y;

      if (this.resizeCorner === 'se') {
        this.rect.w = Math.max(this.minSize, dx);
        this.rect.h = this.aspect === 'free'
          ? Math.max(this.minSize, dy)
          : this.rect.w / (this.aspect as number);
      }

      this.constrain();
      this.draw();
    }
  }

  onPointerUp() {
    this.dragging = false;
    this.resizing = false;
    this.resizeCorner = null;
  }

  onWheel(e: WheelEvent) {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.95 : 1.05;
    this.rect.w *= factor;
    this.rect.h *= factor;
    this.constrain();
    this.draw();
  }

  private constrain() {
    const canvas = this.canvasRef.nativeElement;
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);

    this.rect.w = Math.max(this.minSize, this.rect.w);
    this.rect.h = Math.max(this.minSize, this.rect.h);

    this.rect.x = Math.max(0, Math.min(this.rect.x, w - this.rect.w));
    this.rect.y = Math.max(0, Math.min(this.rect.y, h - this.rect.h));
  }

  private getPos(e: PointerEvent) {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  private inRect(p: any) {
    return p.x > this.rect.x && p.x < this.rect.x + this.rect.w &&
      p.y > this.rect.y && p.y < this.rect.y + this.rect.h;
  }

  private hitCorner(p: any) {
    const s = 15;
    const { x, y, w, h } = this.rect;

    if (Math.abs(p.x - (x + w)) < s && Math.abs(p.y - (y + h)) < s) {
      this.resizeCorner = 'se';
      return true;
    }
    return false;
  }

  crop() {
    const out = document.createElement('canvas');
    const scaleX = this.img.width /
      (this.canvasRef.nativeElement.width / (window.devicePixelRatio || 1));
    const scaleY = this.img.height /
      (this.canvasRef.nativeElement.height / (window.devicePixelRatio || 1));

    out.width = this.rect.w * scaleX;
    out.height = this.rect.h * scaleY;

    const ctx = out.getContext('2d')!;
    ctx.drawImage(
      this.img,
      this.rect.x * scaleX,
      this.rect.y * scaleY,
      out.width,
      out.height,
      0,
      0,
      out.width,
      out.height
    );

    out.toBlob(b => {
      if (b) this.cropped.emit(b);
    }, 'image/webp', 0.92);
  }
}
