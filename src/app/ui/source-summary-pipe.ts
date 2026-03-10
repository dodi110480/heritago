import { Pipe, PipeTransform } from '@angular/core';
import { DisplaySource } from '../models';

@Pipe({
  name: 'sourceSummary',
  standalone: true
})
export class SourceSummaryPipe implements PipeTransform {
  transform(source: DisplaySource | any, fallback: string = 'Unbekannte Quelle'): string {
    if (!source) return fallback;
    
    // Wenn source ein string ist (z.b. ID statt objekt)
    if (typeof source === 'string') return source;

    const parts = [];
    
    if (source.category === 'PRIMARY') parts.push('💎');
    if (source.author) parts.push(source.author);
    if (source.title) parts.push(source.title);
    if (source.publication) parts.push(source.publication);
    if (source.whereInSource) parts.push(`[${source.whereInSource}]`);
    if (source.date) parts.push(source.date);
    if (source.sourceType && source.sourceType !== 'ANDERE') parts.push(`(${source.sourceType})`);

    return parts.length > 0 ? parts.join(' – ') : fallback;
  }
}

