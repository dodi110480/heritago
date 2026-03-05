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
    <div class="fixed inset-0 bg-ui-overlay backdrop-blur-md flex items-center justify-center z-[3000]" (click)="cancel.emit()">
      <div class="modal-glass w-[90vw] max-w-[1200px] h-[85vh] flex flex-col overflow-hidden shadow-2xl" (click)="$event.stopPropagation()">

        <div class="p-6 bg-ui-panel border-b border-ui-border flex items-center justify-between">
          <h3 class="text-xl font-bold text-ui-text">Bild zuschneiden</h3>
          <div class="flex gap-2">
            <button class="btn-ghost !w-auto !px-4 !py-2 border border-ui-border" (click)="setAspect('free')">Frei</button>
            <button class="btn-ghost !w-auto !px-4 !py-2 border border-ui-border" (click)="setAspect(1)">1:1</button>
            <button class="btn-ghost !w-auto !px-4 !py-2 border border-ui-border" (click)="useFullImage()">Ganzes Bild</button>
          </div>
        </div>

        <div class="flex-1 flex items-center justify-center bg-ui-panel overflow-hidden">
          <canvas #canvas
            class="max-w-full max-h-full touch-none rounded-xl"
            (pointerdown)="onPointerDown($event)"
            (pointermove)="onPointerMove($event)"
            (pointerup)="onPointerUp()"
            (pointerleave)="onPointerUp()"
            (wheel)="onWheel($event)"
          ></canvas>
        </div>

        <div class="p-6 bg-ui-panel border-t border-ui-border flex justify-end gap-3">
          <button class="btn-secondary !w-auto !py-2.5 !px-6" (click)="cancel.emit()">Abbrechen</button>
          <button class="btn-primary !w-auto !py-2.5 !px-8" (click)="crop()">Übernehmen</button>
        </div>

      </div>
    </div>
  `
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
  private dragOffsetX = 0;
  private dragOffsetY = 0;

  private minSize = 80;
  private handleSize = 10;
  private cornerHitSize = 18;

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

    const visualW = canvas.width / dpr;
    const visualH = canvas.height / dpr;
    const base = Math.min(visualW, visualH);
    // Start with ~25% of image area side length to improve touch usability on small screens.
    const initial = Math.max(this.minSize, Math.round(base * 0.5));
    this.rect.w = Math.min(initial, visualW);
    this.rect.h = this.aspect === 'free' ? Math.min(initial, visualH) : this.rect.w / (this.aspect as number);
    this.rect.x = Math.max(0, Math.round((visualW - this.rect.w) / 2));
    this.rect.y = Math.max(0, Math.round((visualH - this.rect.h) / 2));

    if (window.innerWidth <= 768) {
      this.minSize = 56;
      this.handleSize = 18;
      this.cornerHitSize = 28;
    } else {
      this.minSize = 80;
      this.handleSize = 10;
      this.cornerHitSize = 18;
    }

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
    const s = this.handleSize;
    const { x, y, w, h } = this.rect;

    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(x - s / 2, y - s / 2, s, s);
    ctx.fillRect(x + w - s / 2, y - s / 2, s, s);
    ctx.fillRect(x - s / 2, y + h - s / 2, s, s);
    ctx.fillRect(x + w - s / 2, y + h - s / 2, s, s);
  }

  onPointerDown(e: PointerEvent) {
    const pos = this.getPos(e);
    this.canvasRef.nativeElement.setPointerCapture(e.pointerId);

    if (this.hitCorner(pos)) {
      this.resizing = true;
    } else if (this.inRect(pos)) {
      this.dragging = true;
      this.dragOffsetX = pos.x - this.rect.x;
      this.dragOffsetY = pos.y - this.rect.y;
    }
  }

  onPointerMove(e: PointerEvent) {
    const pos = this.getPos(e);

    if (this.dragging) {
      this.rect.x = pos.x - this.dragOffsetX;
      this.rect.y = pos.y - this.dragOffsetY;
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
    this.rect.w = Math.min(this.rect.w, w);
    this.rect.h = Math.min(this.rect.h, h);

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
    const s = this.cornerHitSize;
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
