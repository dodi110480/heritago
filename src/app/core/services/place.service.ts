import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environment';

@Injectable({
    providedIn: 'root'
})
export class PlaceService {
    private http = inject(HttpClient);
    private baseApiUrl = `${environment.apiUrl}/tree/`;

    searchPlaces(treeName: string, query: string): Observable<any> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/places/search`, {
            params: { q: query },
            withCredentials: true
        });
    }

    savePlace(treeName: string, data: any): Observable<any> {
        return this.http.post<any>(`${this.baseApiUrl}${treeName}/place`, data, { withCredentials: true });
    }

    getPlaces(treeName: string): Observable<any> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/place`, { withCredentials: true });
    }

    getPlace(treeName: string, placeId: string): Observable<any> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/place/${placeId}`, { withCredentials: true });
    }

    getPlaceUsage(treeName: string, placeId: string): Observable<any> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/place/${placeId}/usage`, { withCredentials: true });
    }

    mergePlaces(treeName: string, sourceId: string, targetId: string): Observable<any> {
        return this.http.post<any>(`${this.baseApiUrl}${treeName}/place/merge`, { sourceId, targetId }, { withCredentials: true });
    }

    deletePlace(treeName: string, placeName: string): Observable<any> {
        return this.http.post<any>(`${this.baseApiUrl}${treeName}/place`, { mode: 'delete', name: placeName }, { withCredentials: true });
    }
}
