import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TreeData } from './models';

@Injectable({
    providedIn: 'root'
})
export class GedcomService {
    private apiUrl = 'http://localhost:8000/index.php?route=%2Fapi%2Ftree%2Ftree1heritago';

    constructor(private http: HttpClient) { }

    getTreeData(): Observable<TreeData> {
        return this.http.get<TreeData>(this.apiUrl);
    }
}
