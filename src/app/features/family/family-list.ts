import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { TreeService } from '../../core/services/tree.service';
import { Individual, Family, TreeData } from '../../core/models/models';
import { FormsModule } from '@angular/forms';
import { AppEntityCard } from '../../shared/components/ui/app-entity-card';
import { AppPageHeaderComponent } from '../../shared/components/ui/app-page-header';
import { AppListViewComponent } from '../../shared/components/ui/app-list-view';

@Component({
    selector: 'app-family-list',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink, AppEntityCard, AppPageHeaderComponent, AppListViewComponent],
    templateUrl: './family-list.html'
})
export class FamilyList implements OnInit {
    private treeService = inject(TreeService);
    private router = inject(Router);

    families = signal<Family[]>([]);
    loading = signal(true);
    searchTerm = signal('');
    sortMode = signal<'date_desc' | 'children_desc' | 'names_asc'>('date_desc');
    sortDirection = signal<'asc' | 'desc'>('desc');
    treeName = signal('');

    sortOptions = [
        { label: 'Neueste Hochzeiten', value: 'date_desc' },
        { label: 'Meiste Kinder', value: 'children_desc' },
        { label: 'Name Partner (A-Z)', value: 'names_asc' }
    ];

    filteredFamilies = computed(() => {
        const term = this.searchTerm().toLowerCase();
        const base = this.families().filter(fam => {
            if (!term) return true;
            const hName = (fam.husbandName || '').toLowerCase();
            const wName = (fam.wifeName || '').toLowerCase();
            return hName.includes(term) || wName.includes(term) || fam.id.toLowerCase().includes(term);
        });

        return this.sortFamilies(base);
    });

    ngOnInit() {
        this.loadData();
    }

    loadData() {
        this.loading.set(true);
        this.treeService.getTreeData().subscribe({
            next: (data) => {
                if (data) {
                    this.families.set(data.families || []);
                    this.treeName.set(data.meta?.tree || '');
                }
                this.loading.set(false);
            },
            error: () => this.loading.set(false)
        });
    }


    private sortFamilies(fams: Family[]): Family[] {
        const mode = this.sortMode();
        const dir = this.sortDirection() === 'asc' ? 1 : -1;

        return [...fams].sort((a, b) => {
            let cmp = 0;
            
            if (mode === 'children_desc') {
                cmp = (a.childrenCount || 0) - (b.childrenCount || 0);
            } else if (mode === 'names_asc') {
                const nameA = ((a.husbandName || '') + ' ' + (a.wifeName || '')).toLowerCase();
                const nameB = ((b.husbandName || '') + ' ' + (b.wifeName || '')).toLowerCase();
                cmp = nameA.localeCompare(nameB);
            } else {
                // date_desc (Marriage date)
                const dateA = a.marriageDate ? new Date(a.marriageDate).getTime() : 9999999999999;
                const dateB = b.marriageDate ? new Date(b.marriageDate).getTime() : 9999999999999;
                cmp = dateA - dateB;
            }

            return cmp * dir;
        });
    }


    goToPerson(id: string | undefined) {
        if (id) this.router.navigate(['/person', id]);
    }

    getChildrenTooltip(fam: Family): string {
        if (!fam.childrenCount) return '';
        return `${fam.childrenCount} ${fam.childrenCount === 1 ? 'Kind' : 'Kinder'}: ${fam.childNames || ''}`;
    }
}
