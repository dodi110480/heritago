import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { DisplayNote } from '../models/models';
import { environment } from '../../environment';

@Injectable({
    providedIn: 'root'
})
export class MediaService {
    private http = inject(HttpClient);

    getMediaUrl(mediaId: string | undefined, variant?: string): string {
        if (!mediaId) return '';
        if (mediaId.startsWith('http') || mediaId.startsWith('/') || mediaId.startsWith('assets/')) return mediaId;
        const v = variant ? `?variant=${variant}` : '';
        // Note: For now, file serving stays direct or we'd need treeName here. 
        // We'll keep it as is if it's based on ID.
        return `${environment.apiUrl}/media/file/${mediaId}${v}`;
    }

    isImage(item: any): boolean {
        if (!item) return false;
        const mime = String(item.mimeType || '').toLowerCase();
        const p = String(item.path || item.filePath || '').toLowerCase();
        return mime.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.webp', '.gif'].some(ext => p.endsWith(ext));
    }

    isPdf(item: any): boolean {
        if (!item) return false;
        const mime = String(item.mimeType || '').toLowerCase();
        const p = String(item.path || item.filePath || '').toLowerCase();
        return mime.includes('pdf') || p.endsWith('.pdf');
    }

    getMedia(treeName: string, type?: string, search?: string): Observable<any> {
        return this.http.get<any>(`${environment.apiUrl}/tree/${treeName}/media`, {
            params: { type: type || '', search: search || '' },
            withCredentials: true
        }).pipe(map(res => res?.data ?? res));
    }

    uploadMedia(treeName: string, userId: string, file: File, title?: string, mediaType?: string): Observable<any> {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('userId', userId);
        if (title) formData.append('title', title);
        if (mediaType) formData.append('mediaType', mediaType);

        return this.http.post<any>(`${environment.apiUrl}/tree/${treeName}/media/upload`, formData, { withCredentials: true }).pipe(
            map(res => res?.data ?? res)
        );
    }

    updateCrop(treeName: string, mediaId: string, crop: { x: number, y: number, width: number, height: number }): Observable<any> {
        return this.http.patch<any>(`${environment.apiUrl}/tree/${treeName}/media/${mediaId}/crop`, crop, { withCredentials: true }).pipe(
            map(res => res?.data ?? res)
        );
    }

    resetCrop(treeName: string, mediaId: string): Observable<any> {
        return this.http.delete<any>(`${environment.apiUrl}/tree/${treeName}/media/${mediaId}/crop`, { withCredentials: true }).pipe(
            map(res => res?.data ?? res)
        );
    }

    getMediaUsage(treeName: string, id: string): Observable<any> {
        return this.http.get<any>(`${environment.apiUrl}/tree/${treeName}/media/${id}/usage`, { withCredentials: true }).pipe(
            map(res => res?.data ?? res)
        );
    }

    deleteMedia(treeName: string, id: string): Observable<any> {
        return this.http.delete<any>(`${environment.apiUrl}/tree/${treeName}/media/${id}`, { withCredentials: true }).pipe(
            map(res => res?.data ?? res)
        );
    }

    updateMedia(treeName: string, id: string, data: {
        title?: string,
        mediaType?: string,
        gedcomId?: string,
        dimensions?: string,
        fileFormat?: string,
        identifiers?: any[],
        notes?: DisplayNote[],
        citations?: any[]
    }): Observable<any> {
        return this.http.patch<any>(`${environment.apiUrl}/tree/${treeName}/media/${id}`, data, { withCredentials: true }).pipe(
            map(res => res?.data ?? res)
        );
    }

    deleteOrphanFile(treeName: string, path: string): Observable<any> {
        return this.http.request<any>('delete', `${environment.apiUrl}/tree/${treeName}/media/orphan-file`, {
            body: { path },
            withCredentials: true
        }).pipe(map(res => res?.data ?? res));
    }

    linkMedia(treeName: string, mediaId: string, linkData: { personId?: string, familyId?: string, sourceId?: string, isPrimary?: boolean }): Observable<any> {
        return this.http.post<any>(`${environment.apiUrl}/tree/${treeName}/media/${mediaId}/link`, linkData, { withCredentials: true }).pipe(
            map(res => res?.data ?? res)
        );
    }

    unlinkMedia(treeName: string, linkId: string): Observable<any> {
        return this.http.delete<any>(`${environment.apiUrl}/tree/${treeName}/media/link/${linkId}`, { withCredentials: true }).pipe(
            map(res => res?.data ?? res)
        );
    }

    adoptOrphanMedia(treeName: string, filePath: string, title?: string, mediaType?: string): Observable<any> {
        return this.http.post<any>(`${environment.apiUrl}/tree/${treeName}/media/adopt-orphan`, {
            filePath,
            title,
            mediaType
        }, { withCredentials: true }).pipe(
            map(res => res?.data ?? res)
        );
    }
}
