import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
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

    getMedia(treeId: string, type?: string, search?: string): Observable<any> {
        return this.http.get<any>(`${environment.apiUrl}/media`, {
            params: { treeId, type: type || '', search: search || '' },
            withCredentials: true
        });
    }

    uploadMedia(treeId: string, userId: string, file: File, title?: string, mediaType?: string): Observable<any> {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('treeId', treeId);
        formData.append('userId', userId);
        if (title) formData.append('title', title);
        if (mediaType) formData.append('mediaType', mediaType);

        return this.http.post<any>(`${environment.apiUrl}/media/upload`, formData, { withCredentials: true });
    }

    updateCrop(mediaId: string, crop: { x: number, y: number, width: number, height: number }): Observable<any> {
        return this.http.patch<any>(`${environment.apiUrl}/media/${mediaId}/crop`, crop, { withCredentials: true });
    }

    resetCrop(mediaId: string): Observable<any> {
        return this.http.delete<any>(`${environment.apiUrl}/media/${mediaId}/crop`, { withCredentials: true });
    }

    getMediaUsage(id: string): Observable<any> {
        return this.http.get<any>(`${environment.apiUrl}/media/${id}/usage`, { withCredentials: true });
    }

    deleteMedia(id: string): Observable<any> {
        return this.http.delete<any>(`${environment.apiUrl}/media/${id}`, { withCredentials: true });
    }

    updateMedia(id: string, data: {
        title?: string,
        mediaType?: string,
        gedcomId?: string,
        dimensions?: string,
        fileFormat?: string,
        identifiers?: any[],
        notes?: DisplayNote[],
        citations?: any[]
    }): Observable<any> {
        return this.http.put<any>(`${environment.apiUrl}/media/${id}`, data, { withCredentials: true });
    }

    deleteOrphanFile(path: string): Observable<any> {
        return this.http.request<any>('delete', `${environment.apiUrl}/media/orphan-file`, {
            body: { path },
            withCredentials: true
        });
    }

    linkMedia(mediaId: string, linkData: { treeId: string, personId?: string, familyId?: string, sourceId?: string, isPrimary?: boolean }): Observable<any> {
        return this.http.post<any>(`${environment.apiUrl}/media/${mediaId}/link`, linkData, { withCredentials: true });
    }

    unlinkMedia(linkId: string): Observable<any> {
        return this.http.delete<any>(`${environment.apiUrl}/media/link/${linkId}`, { withCredentials: true });
    }

    adoptOrphanMedia(treeId: string, filePath: string, title?: string, mediaType?: string): Observable<any> {
        return this.http.post<any>(`${environment.apiUrl}/media/adopt-orphan`, {
            treeId,
            filePath,
            title,
            mediaType
        }, { withCredentials: true });
    }
}
