import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Tree } from './tree';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Tree],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('Heritago');
}
