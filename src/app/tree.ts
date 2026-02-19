import { Component, inject, signal, ElementRef, ViewChild, AfterViewInit, HostListener, OnInit, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { GedcomService } from './gedcom.service';
import { TreeData, Individual, Family, LifeEvent } from './models';
import * as d3 from 'd3';

declare const L: any;

interface HierarchyNode {
    id: string;
    firstName: string;
    lastName: string;
    gender: string;
    dates: string;
    children?: HierarchyNode[];
}

@Component({
    selector: 'app-tree',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './tree.html',
    styleUrl: './tree.css'
})
export class Tree implements AfterViewInit, OnInit {
    private gedcomService = inject(GedcomService);
    private ngZone = inject(NgZone);
    private cdr = inject(ChangeDetectorRef);
    private router = inject(Router);
    treeData = signal<TreeData | null>(null);
    isSaving = false;

    // Modal State
    isModalOpen = false;
    modalTitle = '';
    modalMode: 'add' | 'edit' = 'add';
    activeTab: 'basics' | 'relations' | 'events' = 'basics';

    // Family Modal State
    isFamilyModalOpen = false;
    familyModalData: Family = {
        id: '',
        children: [],
        events: []
    };
    newFamilyEvent: LifeEvent = { type: 'MARR', date: '', place: '', description: '' };
    modalData: any = {
        id: '',
        firstName: '',
        lastName: '',
        birthName: '',
        title: '',
        suffix: '',
        gender: 'U',
        birthDate: '',
        birthPlace: '',
        isAlive: true,
        deathDate: '',
        deathPlace: '',
        email: '',
        fatherId: '',
        motherId: '',
        spouseId: '',
        events: [] as LifeEvent[]
    };

    newEvent: LifeEvent = { type: 'EVEN', date: '', place: '', description: '' };

    // Parent/Spouse Search State
    fatherSearchQuery = '';
    motherSearchQuery = '';
    spouseSearchQuery = '';
    potentialFathers: Individual[] = [];
    potentialMothers: Individual[] = [];
    potentialSpouses: Individual[] = [];
    showFatherResults = false;
    showMotherResults = false;
    showSpouseResults = false;
    showPlaceResults = false;
    potentialPlaces: any[] = [];
    activePlaceField: 'birth' | 'death' | 'event' | 'family' = 'birth';
    activeEventIndex: number | null = null;

    // Place Creator Modal State
    isPlaceModalOpen = false;
    placeErrorMessage = '';
    placeModalData = {
        detail: '',
        city: '',
        district: '',
        region: '',
        country: '',
        latitude: '',
        longitude: '',
        notes: ''
    };

    private pendingRelation: { targetId: string, type: string, gender: string } | null = null;

    ngOnInit() {
        // Initial data load already handled or can be done here
    }

    @ViewChild('treeViewport') svgElement!: ElementRef<SVGElement>;

    private svg: any;
    private g: any;
    private zoom: any;
    private width = window.innerWidth;
    private height = window.innerHeight;

    private nodeWidth = 220;
    private nodeHeight = 100;

    ngAfterViewInit() {
        this.initSvg();
        this.initBackgroundMap();
        this.gedcomService.getTreeData().subscribe(data => {
            if (data) {
                this.treeData.set(data);
                this.renderTree();
            }
        });
    }

    private initSvg() {
        this.svg = d3.select('#tree-viewport')
            .attr('width', '100%')
            .attr('height', '100%');

        this.g = this.svg.append('g');

        this.zoom = d3.zoom()
            .scaleExtent([0.1, 3])
            .on('zoom', (event) => {
                this.g.attr('transform', event.transform);
            });

        this.svg.call(this.zoom);
    }

    private initBackgroundMap() {
        // Wait for element to be in DOM
        setTimeout(() => {
            const mapEl = document.getElementById('tree-background-map');
            if (!mapEl) {
                console.log('Map element not found, retrying...');
                setTimeout(() => this.initBackgroundMap(), 200);
                return;
            }

            // Initialize map - non-interactive
            const map = L.map(mapEl, {
                zoomControl: false,
                attributionControl: false,
                scrollWheelZoom: false,
                dragging: false,
                touchZoom: false,
                doubleClickZoom: false,
                boxZoom: false
            }).setView([51.1657, 10.4515], 5); // Center on Germany roughly, or dynamically later

            setTimeout(() => { map.invalidateSize(); }, 100);

            // Dark Matter / Dark OSM layer
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                subdomains: 'abcd',
                maxZoom: 20
            }).addTo(map);

            // Fetch markers
            // We need tree name. Assuming 'sperlich' or wait for treeData
            // If treeData is not yet loaded, we might need to call this later?
            // Actually, let's just use the current tree from service if available, or default.
            // Better: subscribe to treeData and then update map. But for now, let's try to load once.

            this.gedcomService.getTreeData().subscribe(td => {
                if (td && td.meta && td.meta.tree) {
                    this.gedcomService.getMapData(td.meta.tree).subscribe({
                        next: (res: any) => {
                            console.log('Background Map Response:', res);
                            if (res && res.markers && res.markers.length > 0) {
                                console.log(`Adding ${res.markers.length} background markers.`);
                                res.markers.forEach((m: any) => {
                                    const icon = L.divIcon({
                                        className: 'glowing-dot-blue',
                                        iconSize: [16, 16],
                                        iconAnchor: [8, 8]
                                    });
                                    L.marker([m.lat, m.lng], { icon: icon, interactive: false }).addTo(map);
                                });

                                const bounds = L.latLngBounds(res.markers.map((m: any) => [m.lat, m.lng]));
                                map.fitBounds(bounds, { padding: [50, 50], maxZoom: 6 });
                            } else {
                                console.warn('Background Map: No markers found in response.');
                            }
                        },
                        error: (err) => console.error('Background Map Fetch Error:', err)
                    });
                } else {
                    console.warn('Background Map: Tree data not available yet.');
                }
            });

        }, 100);
    }

    private renderTree() {
        const data = this.treeData();
        if (!data || data.individuals.length === 0) return;

        console.log(`Rendering tree with ${data.individuals.length} individuals and ${data.families.length} families.`);

        const visited = new Set<string>();
        const rootNodes: HierarchyNode[] = [];

        // 1. Identify all "root" individuals
        // A root is someone whose parents are NOT in the dataset.
        const potentialRoots = data.individuals.filter(indi => {
            const famsWhereChild = data.families.filter(f => f.children.includes(indi.id));
            if (famsWhereChild.length === 0) return true;

            // If they are a child, check if ANY of their families have parents present in individuals list
            return !famsWhereChild.some(f => {
                const husbandExists = f.husband && data.individuals.some(i => i.id === f.husband);
                const wifeExists = f.wife && data.individuals.some(i => i.id === f.wife);
                return husbandExists || wifeExists;
            });
        });

        // Pick the actual roots and build hierarchies
        potentialRoots.forEach(rootIndi => {
            if (!visited.has(rootIndi.id)) {
                // Improved root logic: If this root has a spouse who is also a root, 
                // handle them together to avoid fragmented trees.
                const fam = data.families.find(f => f.husband === rootIndi.id || f.wife === rootIndi.id);
                if (fam && fam.husband && fam.wife) {
                    const hNode = data.individuals.find(i => i.id === fam.husband);
                    const wNode = data.individuals.find(i => i.id === fam.wife);
                    if (hNode && wNode) {
                        if (!visited.has(hNode.id)) rootNodes.push(this.buildHierarchy(hNode.id, data, visited));
                        if (!visited.has(wNode.id)) rootNodes.push(this.buildHierarchy(wNode.id, data, visited));
                    }
                } else if (!visited.has(rootIndi.id)) {
                    rootNodes.push(this.buildHierarchy(rootIndi.id, data, visited));
                }
            }
        });

        // 2. Catch any leftover disconnected people
        data.individuals.forEach(indi => {
            if (!visited.has(indi.id)) {
                rootNodes.push(this.buildHierarchy(indi.id, data, visited));
            }
        });

        console.log(`Identified ${rootNodes.length} roots for the tree.`);

        // 3. Create a virtual root if there are multiple roots
        let hierarchy: HierarchyNode;
        if (rootNodes.length === 1) {
            hierarchy = rootNodes[0];
        } else {
            hierarchy = {
                id: 'forest-root',
                firstName: 'Hidden',
                lastName: 'Root',
                gender: 'U',
                dates: '',
                children: rootNodes
            };
        }

        // 4. Create d3 tree layout
        const root = d3.hierarchy(hierarchy);
        const treeLayout = d3.tree<HierarchyNode>()
            .nodeSize([this.nodeWidth + 60, this.nodeHeight + 100])
            .separation((a, b) => {
                // Siblings are closer than cousins or unrelated roots
                return a.parent === b.parent ? 1 : 1.5;
            });

        treeLayout(root);

        // --- Partner Alignment: Ensure spouses are strictly on same level ---
        const descendants = root.descendants();
        const nodes_map = new Map(descendants.map(d => [d.data.id, d]));

        data.families.forEach(fam => {
            if (fam.husband && fam.wife) {
                const hNode: any = nodes_map.get(fam.husband);
                const wNode: any = nodes_map.get(fam.wife);

                if (hNode && wNode && Math.abs(hNode.y - wNode.y) > 1) {
                    // Force both to the same Y level
                    const targetY = Math.min(hNode.y, wNode.y);
                    hNode.y = targetY;
                    wNode.y = targetY;
                }

                // Ensure proximity if they are far apart
                if (hNode && wNode && Math.abs(hNode.x - wNode.x) > (this.nodeWidth + 200)) {
                    const leftNode = hNode.x < wNode.x ? hNode : wNode;
                    const rightNode = hNode.x < wNode.x ? wNode : hNode;
                    const targetX = leftNode.x + this.nodeWidth + 60; // Standard spouse gap

                    if (rightNode.x > targetX) {
                        const shift = targetX - rightNode.x;
                        rightNode.each((desc: any) => {
                            if (desc.x !== undefined) desc.x += shift;
                        });
                    }
                }
            }
        });

        // --- Sibling Alignment & Proximity: Ensure siblings are on same level and adjacent ---
        data.families.forEach(fam => {
            if (fam.children && fam.children.length > 1) {
                const childNodes = fam.children.map(cid => nodes_map.get(cid)).filter(n => !!n) as any[];

                if (childNodes.length > 0) {
                    // 1. Force same level (y)
                    const minY = d3.min(childNodes, d => d.y) || 0;
                    childNodes.forEach(c => c.y = minY);

                    // 2. Ensure adjacency (x)
                    // This is more complex because shifting one node affects others.
                    // We'll sort them and ensure a minimum gap of 60px (No-Touch Rule).
                    childNodes.sort((a, b) => a.x - b.x);
                    const siblingGap = this.nodeWidth + 60; // 60px gap for siblings

                    for (let i = 1; i < childNodes.length; i++) {
                        const targetX = childNodes[i - 1].x + siblingGap;
                        if (childNodes[i].x < targetX) {
                            const shift = targetX - childNodes[i].x;
                            childNodes[i].each((desc: any) => {
                                if (desc.x !== undefined) desc.x += shift;
                            });
                        }
                    }
                }
            }
        });

        // --- Symmetry Adjustment: Center children between parents ---
        data.families.forEach(fam => {
            if (fam.husband && fam.wife && fam.children && fam.children.length > 0) {
                const hNode: any = nodes_map.get(fam.husband);
                const wNode: any = nodes_map.get(fam.wife);

                if (hNode && wNode && hNode.x !== undefined && hNode.y !== undefined && wNode.x !== undefined && wNode.y !== undefined && Math.abs(hNode.y - wNode.y) < 10) {
                    const familyChildren = fam.children.map(cid => nodes_map.get(cid)).filter(n => !!n) as any[];
                    if (familyChildren.length > 0) {
                        const minX = d3.min(familyChildren, d => d.x) || 0;
                        const maxX = d3.max(familyChildren, d => d.x) || 0;
                        const childrenCenter = (minX + maxX) / 2;
                        const parentsCenter = (hNode.x + wNode.x) / 2;
                        const offset = parentsCenter - childrenCenter;

                        familyChildren.forEach(c => {
                            c.each((desc: any) => {
                                if (desc.x !== undefined) desc.x += offset;
                            });
                        });
                    }
                }
            }
        });
        // -----------------------------------------------------------

        // 3. Clear existing elements
        this.g.selectAll('*').remove();

        // 4. Draw links
        const nodes = root.descendants().filter((d: any) => d.data.id !== 'forest-root');

        this.g.selectAll('.link')
            .data(root.links().filter((d: any) => d.source.data.id !== 'forest-root'))
            .enter()
            .append('path')
            .attr('class', 'link')
            .style('fill', 'none')
            .style('stroke', '#cbd5e1')
            .style('stroke-width', '2.5px')
            .attr('d', (d: any) => {
                let sourceX = d.source.x + this.nodeWidth / 2;
                let sourceY = d.source.y + this.nodeHeight;
                const targetX = d.target.x + this.nodeWidth / 2;
                const targetY = d.target.y;

                // Adjust sourceX if this is a family with two parents present
                const fam = data.families.find(f =>
                    (f.husband === d.source.data.id || f.wife === d.source.data.id) &&
                    f.children.includes(d.target.data.id)
                );

                if (fam && fam.husband && fam.wife) {
                    const hNode: any = nodes.find(n => n.data.id === fam.husband);
                    const wNode: any = nodes.find(n => n.data.id === fam.wife);
                    if (hNode && wNode && hNode.x !== undefined && hNode.y !== undefined && wNode.x !== undefined && wNode.y !== undefined) {
                        // If they are on the same level (likely roots or siblings), start between them
                        if (Math.abs(hNode.y - wNode.y) < 10) {
                            sourceX = (hNode.x + wNode.x) / 2 + this.nodeWidth / 2;
                            sourceY = hNode.y + this.nodeHeight / 2;
                        }
                    }
                }

                let midY = (sourceY + targetY) / 2;

                // For single parent families, move the horizontal line closer to the parent
                // to avoid visual collision with the "couple" bus line
                if (fam && (!fam.husband || !fam.wife)) {
                    midY = sourceY + (targetY - sourceY) * 0.25;
                }

                const radius = 12;

                if (Math.abs(sourceX - targetX) < 1) {
                    return `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
                }

                const direction = targetX > sourceX ? 1 : -1;

                return `M ${sourceX} ${sourceY}
                        V ${midY - radius}
                        Q ${sourceX} ${midY} ${sourceX + direction * radius} ${midY}
                        H ${targetX - direction * radius}
                        Q ${targetX} ${midY} ${targetX} ${midY + radius}
                        V ${targetY}`;
            });

        // 5. Draw Spouse Links
        data.families.forEach(fam => {
            if (fam.husband && fam.wife) {
                const hNode: any = nodes.find(n => n.data.id === fam.husband);
                const wNode: any = nodes.find(n => n.data.id === fam.wife);
                if (hNode && wNode && hNode.x !== undefined && hNode.y !== undefined && wNode.x !== undefined && wNode.y !== undefined && Math.abs(hNode.y - wNode.y) < 10) {
                    const leftNode = hNode.x < wNode.x ? hNode : wNode;
                    const rightNode = hNode.x < wNode.x ? wNode : hNode;

                    const centerX = (leftNode.x + this.nodeWidth + rightNode.x) / 2;
                    const centerY = leftNode.y + this.nodeHeight / 2;

                    // The Link
                    this.g.append('line')
                        .attr('class', 'spouse-link')
                        .attr('x1', leftNode.x + this.nodeWidth)
                        .attr('y1', centerY)
                        .attr('x2', rightNode.x)
                        .attr('y2', centerY)
                        .style('stroke', '#cbd5e1')
                        .style('stroke-width', '2.5px');

                    // The Circle / Icon Group
                    const group = this.g.append('g')
                        .attr('class', 'family-node')
                        .style('cursor', 'pointer')
                        .on('click', () => {
                            this.ngZone.run(() => this.openFamilyModal(fam.id));
                        });

                    group.append('circle')
                        .attr('cx', centerX)
                        .attr('cy', centerY)
                        .attr('r', 18)
                        .style('fill', '#ffffff')
                        .style('stroke', '#cbd5e1')
                        .style('stroke-width', '2px');

                    // Check if they are married (has MARR event)
                    const isMarried = fam.events?.some(e => e.type === 'MARR');
                    if (isMarried) {
                        group.append('image')
                            .attr('href', 'icons/marriage.svg')
                            .attr('x', centerX - 10)
                            .attr('y', centerY - 10)
                            .attr('width', 20)
                            .attr('height', 20);
                    } else {
                        // Default plus or just empty circle? User asked for marriage_symbol
                        // Let's just put it there if married, otherwise maybe a subtle plus?
                        // For now just the circle if not married.
                    }
                }
            }
        });

        // 5. Draw nodes (Filter out forest-root)
        const node = this.g.selectAll('.node')
            .data(root.descendants().filter((d: any) => d.data.id !== 'forest-root'))
            .enter()
            .append('g')
            .attr('class', (d: any) => {
                const gender = d.data.gender === 'M' ? 'male' : (d.data.gender === 'F' ? 'female' : (d.data.gender === 'X' ? 'other' : 'unknown'));
                return `node ${gender}`;
            })
            .style('cursor', 'pointer')
            .attr('transform', (d: any) => `translate(${d.x},${d.y})`);

        // Node card
        node.append('rect')
            .attr('class', 'card')
            .attr('width', this.nodeWidth)
            .attr('height', this.nodeHeight)
            .attr('rx', 8)
            .attr('ry', 8)
            .style('fill', '#ffffff')
            .style('stroke', (d: any) => {
                if (d.data.gender === 'M') return '#3b82f6';
                if (d.data.gender === 'F') return '#ef4444';
                if (d.data.gender === 'X') return '#8b5cf6';
                return '#cbd5e1';
            })
            .style('stroke-width', '2px');

        // Avatar placeholder
        const avatarSize = 60;
        const avatarMargin = 15;

        node.append('circle')
            .attr('class', 'avatar-bg')
            .attr('cx', avatarMargin + avatarSize / 2)
            .attr('cy', this.nodeHeight / 2)
            .attr('r', avatarSize / 2)
            .style('fill', '#f1f5f9');

        node.append('path')
            .attr('class', 'avatar-icon')
            .attr('transform', (d: any) => `translate(${avatarMargin + 15}, ${this.nodeHeight / 2 - 15}) scale(1.2)`)
            .attr('d', 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z')
            .style('fill', '#94a3b8');

        // FirstName
        node.append('text')
            .attr('class', 'first-name')
            .attr('x', avatarMargin + avatarSize + 25)
            .attr('y', this.nodeHeight / 2 - 12)
            .style('fill', '#1e293b')
            .style('font-family', 'Inter, system-ui, sans-serif')
            .style('font-weight', '700')
            .style('font-size', '16px')
            .text((d: any) => d.data.firstName);

        // LastName
        node.append('text')
            .attr('class', 'last-name')
            .attr('x', avatarMargin + avatarSize + 25)
            .attr('y', this.nodeHeight / 2 + 8)
            .style('fill', '#1e293b')
            .style('font-family', 'Inter, system-ui, sans-serif')
            .style('font-weight', '700')
            .style('font-size', '16px')
            .text((d: any) => d.data.lastName);

        // Dates
        node.append('text')
            .attr('class', 'dates')
            .attr('x', avatarMargin + avatarSize + 25)
            .attr('y', this.nodeHeight - 12)
            .style('fill', '#64748b')
            .style('font-family', 'Inter, system-ui, sans-serif')
            .style('font-size', '12px')
            .text((d: any) => d.data.dates);

        // Edit Icon (Pencil)
        const editIcon = node.append('g')
            .attr('class', 'edit-icon')
            .style('cursor', 'pointer')
            .attr('transform', `translate(${this.nodeWidth - 40}, 5)`)
            .on('click', (event: any, d: any) => {
                event.stopPropagation();
                this.ngZone.run(() => this.openModal('edit', d.data.id));
            });

        // Clickable background for pencil
        editIcon.append('rect')
            .attr('width', 35)
            .attr('height', 35)
            .attr('fill', 'transparent');

        editIcon.append('path')
            .attr('d', 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z')
            .style('fill', '#64748b')
            .attr('transform', 'translate(5, 5) scale(1.2)');


        // Add Relative Button (+)
        const addButtonSize = 24;
        const addBtn = node.append('g')
            .attr('class', 'add-btn')
            .style('cursor', 'pointer')
            .attr('transform', `translate(${this.nodeWidth / 2 - addButtonSize / 2}, ${this.nodeHeight - addButtonSize / 2})`)
            .on('click', (event: any, d: any) => {
                event.stopPropagation();
                this.toggleAddMenu(d, event.currentTarget.parentNode);
            });

        addBtn.append('circle')
            .attr('r', addButtonSize / 2)
            .attr('cx', addButtonSize / 2)
            .attr('cy', addButtonSize / 2)
            .style('fill', '#ffffff')
            .style('stroke', '#cbd5e1')
            .style('stroke-width', '1.5px');

        addBtn.append('text')
            .attr('x', addButtonSize / 2)
            .attr('y', addButtonSize / 2 + 5)
            .attr('text-anchor', 'middle')
            .style('fill', '#64748b')
            .style('font-size', '18px')
            .style('font-weight', 'bold')
            .text('+');

        // 6. Initial positioning (center the root)
        this.resetZoom();
    }

    private toggleAddMenu(d: any, nodeElement: any) {
        console.log('Toggling add menu for:', d.data.name);
        const d3Node = d3.select(nodeElement);
        const existingMenu = d3Node.select('.add-relative-menu');

        if (!existingMenu.empty()) {
            existingMenu.remove();
            return;
        }

        // Close any other open menus
        d3.selectAll('.add-relative-menu').remove();

        // Bring this node to the front so its menu is on top
        d3Node.raise();

        const menuWidth = 160;
        const menuHeight = 50;
        const spacing = 10;

        const menu = d3Node.append('g')
            .attr('class', 'add-relative-menu')
            .style('opacity', 0);

        const options = [
            { label: 'Bruder hinzufügen', type: 'brother', gender: 'M' },
            { label: 'Schwester hinzufügen', type: 'sister', gender: 'F' },
            { label: 'Partner hinzufügen', type: 'partner', gender: 'F' },
            { label: 'Sohn hinzufügen', type: 'son', gender: 'M' },
            { label: 'Tochter hinzufügen', type: 'daughter', gender: 'F' }
        ];

        options.forEach((opt, i) => {
            const x = i < 2 ? -menuWidth - spacing : (i === 2 ? this.nodeWidth + spacing : (i === 3 ? 0 : menuWidth + spacing));
            const y = i === 1 ? menuHeight + spacing : (i > 2 ? this.nodeHeight + spacing + 10 : 0);

            const item = menu.append('g')
                .attr('transform', `translate(${x}, ${y})`)
                .attr('class', `menu-item ${opt.gender === 'M' ? 'male' : 'female'}`)
                .on('click', (e) => {
                    e.stopPropagation();
                    this.ngZone.run(() => {
                        this.pendingRelation = { targetId: d.data.id, type: opt.type, gender: opt.gender };
                        this.openModal('add');
                    });
                    menu.remove();
                });

            item.append('rect')
                .attr('width', menuWidth)
                .attr('height', menuHeight)
                .attr('rx', 6)
                .attr('ry', 6)
                .style('fill', '#ffffff')
                .style('stroke', opt.gender === 'M' ? '#3b82f6' : '#ef4444')
                .style('stroke-width', '2px');

            item.append('text')
                .attr('x', 10)
                .attr('y', menuHeight / 2 + 5)
                .style('fill', '#1e293b')
                .style('font-size', '12px')
                .style('font-weight', '600')
                .text(opt.label);
        });

        menu.transition()
            .duration(300)
            .style('opacity', 1);
    }

    openModal(mode: 'add' | 'edit', personId?: string) {
        console.log(`Opening modal: mode=${mode}, personId=${personId}`);
        this.isModalOpen = true;
        this.modalMode = mode;
        this.activeTab = 'basics';

        if (mode === 'edit' && personId) {
            const data = this.treeData();
            const person = data?.individuals.find(i => i.id === personId);
            if (person && data) {
                this.modalTitle = 'Person bearbeiten';

                let firstName = '';
                let lastName = '';

                // Try to parse from gedcomName if available (e.g. "Create /Tree/")
                if (person.gedcomName) {
                    const parts = person.gedcomName.split('/');
                    if (parts.length >= 2) {
                        firstName = parts[0].trim();
                        lastName = parts[1].trim();
                    } else {
                        firstName = person.gedcomName.trim();
                    }
                } else {
                    // Fallback: split by last space (imperfect but better than nothing)
                    const nameParts = person.name.split(' ');
                    if (nameParts.length > 1) {
                        lastName = nameParts.pop() || '';
                        firstName = nameParts.join(' ');
                    } else {
                        firstName = person.name;
                    }
                }

                // Resolve Relationships
                let fatherId = '';
                let fatherName = '';
                let motherId = '';
                let motherName = '';
                let spouseId = '';
                let spouseName = '';

                // Find Parents (Family where this person is a child)
                const parentFam = data.families.find(f => f.children.includes(person.id));
                if (parentFam) {
                    if (parentFam.husband) {
                        fatherId = parentFam.husband || '';
                        fatherName = data.individuals.find(i => i.id === fatherId)?.name || '';
                    }
                    if (parentFam.wife) {
                        motherId = parentFam.wife || '';
                        motherName = data.individuals.find(i => i.id === motherId)?.name || '';
                    }
                }

                // Find Spouse (Family where this person is husband or wife)
                // Just take the first one for now if multiple
                const spouseFam = data.families.find(f =>
                    (f.husband === person.id && f.wife) ||
                    (f.wife === person.id && f.husband)
                );
                if (spouseFam) {
                    if (spouseFam.husband === person.id) {
                        spouseId = spouseFam.wife || '';
                    } else {
                        spouseId = spouseFam.husband || '';
                    }
                    spouseName = data.individuals.find(i => i.id === spouseId)?.name || '';
                }

                this.modalData = {
                    id: person.id,
                    firstName: person.firstName || firstName,
                    lastName: person.lastName || lastName,
                    birthName: person.birthName || '',
                    title: person.title || '',
                    suffix: person.suffix || '',
                    gender: person.gender,
                    birthDate: person.birthDate || '',
                    birthPlace: person.birthPlace || '',
                    isAlive: person.isAlive ?? !person.deathDate,
                    deathDate: person.deathDate || '',
                    deathPlace: person.deathPlace || '',
                    email: person.email || '',
                    fatherId: fatherId,
                    motherId: motherId,
                    spouseId: spouseId,
                    events: person.events ? [...person.events] : []
                };

                this.fatherSearchQuery = fatherName;
                this.motherSearchQuery = motherName;
                this.spouseSearchQuery = spouseName;
            }
        } else {
            this.modalTitle = 'Neue Person hinzufügen';
            this.modalData = {
                id: '',
                firstName: '',
                lastName: '',
                birthName: '',
                title: '',
                suffix: '',
                gender: this.pendingRelation?.gender || 'U',
                birthDate: '',
                birthPlace: '',
                isAlive: true,
                deathDate: '',
                deathPlace: '',
                email: '',
                fatherId: '',
                motherId: '',
                spouseId: '',
                events: []
            };

            this.fatherSearchQuery = '';
            this.motherSearchQuery = '';
            this.spouseSearchQuery = '';

            // Pre-fill parent and last name if adding child
            if (this.pendingRelation?.type === 'son' || this.pendingRelation?.type === 'daughter') {
                const individuals = this.treeData()?.individuals || [];
                const families = this.treeData()?.families || [];
                const anchor = individuals.find(i => i.id === this.pendingRelation?.targetId);

                if (anchor) {
                    let suggestedLastName = '';

                    if (anchor.gender === 'M') {
                        suggestedLastName = anchor.lastName || '';
                        this.modalData.fatherId = anchor.id;
                        this.fatherSearchQuery = anchor.name;
                    } else if (anchor.gender === 'F') {
                        this.modalData.motherId = anchor.id;
                        this.motherSearchQuery = anchor.name;

                        // Try to find a husband to get the family name
                        const fam = families.find(f => f.wife === anchor.id && f.husband);
                        if (fam && fam.husband) {
                            const husband = individuals.find(i => i.id === fam.husband);
                            if (husband) {
                                suggestedLastName = husband.lastName || '';
                            }
                        }

                        // Fallback to mother's current last name
                        if (!suggestedLastName) {
                            suggestedLastName = anchor.lastName || '';
                        }
                    }

                    if (suggestedLastName) {
                        this.modalData.lastName = suggestedLastName;
                    }
                }
            }

            this.potentialFathers = [];
            this.potentialMothers = [];
            this.potentialSpouses = [];
        }
        this.cdr.markForCheck();
    }

    closeModal() {
        this.isModalOpen = false;
        this.pendingRelation = null;
        this.cdr.markForCheck();
    }

    savePerson() {
        const data = this.treeData();
        if (!data || this.isSaving) return;

        this.isSaving = true;

        const targetId = this.pendingRelation?.targetId;
        const relationType = this.pendingRelation?.type;

        let fatherId = this.modalData.fatherId;
        let motherId = this.modalData.motherId;

        // If we are adding a child to a parent anchor, ensure that parent is set as father/mother
        if (targetId && (relationType === 'son' || relationType === 'daughter')) {
            const anchor = data.individuals.find(i => i.id === targetId);
            if (anchor) {
                if (anchor.gender === 'M' && !fatherId) fatherId = anchor.id;
                if (anchor.gender === 'F' && !motherId) motherId = anchor.id;
            }
        }

        const payload = {
            mode: this.modalMode,
            id: this.modalData.id,
            firstName: this.modalData.firstName,
            lastName: this.modalData.lastName,
            birthName: this.modalData.birthName,
            title: this.modalData.title,
            suffix: this.modalData.suffix,
            gender: this.modalData.gender,
            birthDate: this.modalData.birthDate,
            birthPlace: this.modalData.birthPlace,
            isAlive: this.modalData.isAlive,
            deathDate: this.modalData.deathDate,
            deathPlace: this.modalData.deathPlace,
            email: this.modalData.email,
            targetId: targetId,
            relationType: relationType,
            fatherId: fatherId,
            motherId: motherId,
            spouseId: this.modalData.spouseId,
            events: this.modalData.events
        };

        console.log('Sending Save Payload:', payload);
        console.log('Father ID:', fatherId, 'Mother ID:', motherId);

        // Assume current tree is 'sperlich' or derive from URL/meta
        const treeName = 'sperlich'; // TODO: Get from route/meta

        this.gedcomService.savePerson(treeName, payload).subscribe({
            next: (res) => {
                console.log('Person saved successfully', res);
                this.closeModal(); // Close immediately on success

                // Reload tree data to reflect changes from server
                this.gedcomService.getTreeData(treeName).subscribe(newData => {
                    this.treeData.set(newData);
                    this.renderTree();
                    this.isSaving = false;
                });
            },
            error: (err) => {
                console.error('Error saving person', err);
                const msg = err.error?.message || 'Fehler beim Speichern der Person.';
                alert(msg);
                this.isSaving = false;
            }
        });
    }

    openFamilyModal(famId: string) {
        const data = this.treeData();
        if (!data) return;

        const fam = data.families.find(f => f.id === famId);
        if (fam) {
            this.familyModalData = JSON.parse(JSON.stringify(fam));
            if (!this.familyModalData.events) this.familyModalData.events = [];
            this.isFamilyModalOpen = true;
            this.cdr.markForCheck();
        }
    }

    closeFamilyModal() {
        this.isFamilyModalOpen = false;
        this.cdr.markForCheck();
    }

    addFamilyEvent() {
        if (!this.familyModalData.events) this.familyModalData.events = [];
        this.familyModalData.events.push({ ...this.newFamilyEvent });
        this.newFamilyEvent = { type: 'MARR', date: '', place: '', description: '' };
    }

    saveFamily() {
        if (this.isSaving) return;
        this.isSaving = true;

        const treeName = 'sperlich'; // TODO: Get from route/meta

        this.gedcomService.saveFamily(treeName, this.familyModalData).subscribe({
            next: (res) => {
                console.log('Family saved successfully', res);
                this.closeFamilyModal();

                // Reload tree data
                this.gedcomService.getTreeData(treeName).subscribe(newData => {
                    this.treeData.set(newData);
                    this.renderTree();
                    this.isSaving = false;
                });
            },
            error: (err) => {
                console.error('Error saving family', err);
                const msg = err.error?.message || err.message || 'Unbekannter Fehler';
                alert('Fehler beim Speichern der Familie: ' + msg);
                this.isSaving = false;
            }
        });
    }

    deletePerson() {
        const data = this.treeData();
        if (!data || !this.modalData.id) return;

        if (!confirm(`Möchten Sie ${this.modalData.firstName} ${this.modalData.lastName} wirklich löschen?`)) {
            return;
        }

        // Assume current tree is 'sperlich' or derive from URL/meta
        const treeName = 'sperlich'; // TODO: Get from route/meta

        this.gedcomService.deletePerson(treeName, this.modalData.id).subscribe({
            next: () => {
                // Reload tree data to reflect changes from server
                this.gedcomService.getTreeData(treeName).subscribe(newData => {
                    this.treeData.set(newData);
                    this.renderTree();
                });
                this.closeModal();
            },
            error: (err) => {
                console.error('Error deleting person', err);
                alert('Fehler beim Löschen der Person.');
            }
        });
    }

    private buildHierarchy(rootId: string, data: TreeData, visited: Set<string>): HierarchyNode {
        const indi = data.individuals.find(i => i.id === rootId);
        if (!indi) {
            return { id: 'unknown', firstName: 'Unknown', lastName: '', gender: 'U', dates: '' };
        }

        visited.add(rootId);

        const fullName = this.stripHtml(indi.name);
        const nameParts = fullName.split(' ');
        const lastName = nameParts.length > 1 ? (nameParts.pop() || '') : '';
        const firstName = nameParts.join(' ');

        const node: HierarchyNode = {
            id: indi.id,
            firstName: firstName,
            lastName: lastName,
            gender: indi.gender,
            dates: `${this.stripHtml(indi.birthDate || '')} - ${this.stripHtml(indi.deathDate || '')}`.trim(),
            children: []
        };
        if (node.dates === '-') node.dates = '';

        const parentFamilies = data.families.filter(f => f.husband === rootId || f.wife === rootId);
        parentFamilies.forEach(fam => {
            fam.children.forEach(childId => {
                if (!visited.has(childId)) {
                    node.children?.push(this.buildHierarchy(childId, data, visited));
                }
            });
        });

        if (node.children?.length === 0) {
            delete node.children;
        }

        return node;
    }


    private renderRoot(hierarchy: HierarchyNode) {
        const root = d3.hierarchy(hierarchy);
        const treeLayout = d3.tree<HierarchyNode>()
            .nodeSize([this.nodeWidth + 40, this.nodeHeight + 100]);

        treeLayout(root);

        this.g.selectAll('*').remove();
        this.drawTreeElements(root);
        this.resetZoom();
    }

    private drawTreeElements(root: d3.HierarchyNode<HierarchyNode>) {
        // Abstracted drawing logic from renderTree
        // Draw links
        this.g.selectAll('.link')
            .data(root.links())
            .enter()
            .append('path')
            .attr('class', 'link')
            .style('fill', 'none')
            .style('stroke', '#cbd5e1')
            .style('stroke-width', '2.5px')
            .attr('d', (d: any) => {
                const sourceX = d.source.x + this.nodeWidth / 2;
                const sourceY = d.source.y + this.nodeHeight;
                const targetX = d.target.x + this.nodeWidth / 2;
                const targetY = d.target.y + this.nodeHeight / 2; // Adjust target Y
                const midY = (sourceY + d.target.y) / 2;

                return `M ${sourceX} ${sourceY} V ${midY} H ${targetX} V ${d.target.y}`;
            });

        // Re-use full logic from renderTree for nodes... 
        // Note: For brevity in this replace call, I'll keep the renderTree mostly but add this navigation.
        this.renderTree(); // Simplest for now
    }
    private stripHtml(html: string): string {
        const tmp = document.createElement('DIV');
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || '';
    }

    @HostListener('window:resize')
    onResize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
    }

    zoomIn() {
        this.svg.transition().call(this.zoom.scaleBy, 1.3);
    }

    zoomOut() {
        this.svg.transition().call(this.zoom.scaleBy, 0.7);
    }

    resetZoom() {
        this.svg.transition().duration(750).call(
            this.zoom.transform,
            d3.zoomIdentity.translate(this.width / 2 - this.nodeWidth / 2, 100).scale(0.8)
        );
    }
    searchPerson(type: 'father' | 'mother' | 'spouse', query: string) {
        if (type === 'father') this.fatherSearchQuery = query;
        else if (type === 'mother') this.motherSearchQuery = query;
        else this.spouseSearchQuery = query;

        if (!query) {
            if (type === 'father') {
                this.modalData.fatherId = '';
                this.potentialFathers = [];
                this.showFatherResults = false;
            } else if (type === 'mother') {
                this.modalData.motherId = '';
                this.potentialMothers = [];
                this.showMotherResults = false;
            } else {
                this.modalData.spouseId = '';
                this.potentialSpouses = [];
                this.showSpouseResults = false;
            }
            return;
        }

        const data = this.treeData();
        if (!data) return;

        const results = data.individuals.filter(i =>
            i.name.toLowerCase().includes(query.toLowerCase()) &&
            i.id !== this.modalData.id // Cannot be own parent/spouse
        );

        if (type === 'father') {
            this.potentialFathers = results;
            this.showFatherResults = true;
        } else if (type === 'mother') {
            this.potentialMothers = results;
            this.showMotherResults = true;
        } else {
            this.potentialSpouses = results;
            this.showSpouseResults = true;
        }
    }

    selectPerson(type: 'father' | 'mother' | 'spouse', person: Individual) {
        if (type === 'father') {
            this.modalData.fatherId = person.id;
            this.fatherSearchQuery = person.name;
            this.showFatherResults = false;
        } else if (type === 'mother') {
            this.modalData.motherId = person.id;
            this.motherSearchQuery = person.name;
            this.showMotherResults = false;
        } else {
            this.modalData.spouseId = person.id;
            this.spouseSearchQuery = person.name;
            this.showSpouseResults = false;
        }
    }

    clearPerson(type: 'father' | 'mother' | 'spouse') {
        if (type === 'father') {
            this.modalData.fatherId = '';
            this.fatherSearchQuery = '';
        } else if (type === 'mother') {
            this.modalData.motherId = '';
            this.motherSearchQuery = '';
        } else {
            this.modalData.spouseId = '';
            this.spouseSearchQuery = '';
        }
    }

    // Event Management
    setActiveTab(tab: 'basics' | 'relations' | 'events') {
        this.activeTab = tab;
    }

    addEvent() {
        if (!this.newEvent.type) return;
        this.modalData.events.push({ ...this.newEvent });
        this.newEvent = { type: 'EVEN', date: '', place: '', description: '' };
    }

    removeEvent(index: number) {
        this.modalData.events.splice(index, 1);
    }

    // Place Management
    searchPlaces(query: string, field: 'birth' | 'death' | 'event' | 'family', eventIndex: number | null = null) {
        this.activePlaceField = field;
        this.activeEventIndex = eventIndex;

        if (!query) {
            this.potentialPlaces = [];
            this.showPlaceResults = false;
            return;
        }

        const currentTree = this.treeData()?.meta?.tree;
        if (!currentTree) return;

        this.gedcomService.searchPlaces(currentTree, query).subscribe(response => {
            if (response.success) {
                this.potentialPlaces = response.results;
                this.showPlaceResults = true;
            }
        });
    }

    selectPlace(place: any) {
        if (this.activePlaceField === 'birth') {
            this.modalData.birthPlace = place.name;
        } else if (this.activePlaceField === 'death') {
            this.modalData.deathPlace = place.name;
        } else if (this.activePlaceField === 'event' && this.activeEventIndex !== null) {
            this.modalData.events[this.activeEventIndex].place = place.name;
        } else if (this.activePlaceField === 'family') {
            this.newFamilyEvent.place = place.name;
        }
        this.showPlaceResults = false;
    }

    openPlaceModal(prefill: string = '') {
        this.placeErrorMessage = '';

        const parts = prefill.split(',').map(p => p.trim());
        // Right-align if fewer than 5 parts
        const fullParts = new Array(5).fill('');
        const offset = Math.max(0, 5 - parts.length);
        for (let i = 0; i < parts.length; i++) {
            if (i + offset < 5) fullParts[i + offset] = parts[i];
        }

        this.placeModalData = {
            detail: fullParts[0],
            city: fullParts[1],
            district: fullParts[2],
            region: fullParts[3],
            country: fullParts[4],
            latitude: '',
            longitude: '',
            notes: ''
        };
        this.isPlaceModalOpen = true;
    }

    closePlaceModal() {
        this.isPlaceModalOpen = false;
    }

    savePlace() {
        const currentTree = this.treeData()?.meta?.tree;
        if (!currentTree) return;

        this.placeErrorMessage = '';
        this.isSaving = true;

        const name = [
            this.placeModalData.detail.trim(),
            this.placeModalData.city.trim(),
            this.placeModalData.district.trim(),
            this.placeModalData.region.trim(),
            this.placeModalData.country.trim()
        ].join(', ');

        const payload = {
            name: name,
            latitude: this.placeModalData.latitude,
            longitude: this.placeModalData.longitude,
            notes: this.placeModalData.notes
        };

        this.gedcomService.savePlace(currentTree, payload).subscribe({
            next: (response: any) => {
                this.isSaving = false;
                if (response.success) {
                    // Apply name to the active field
                    if (this.activePlaceField === 'birth') {
                        this.modalData.birthPlace = response.place.name;
                    } else if (this.activePlaceField === 'death') {
                        this.modalData.deathPlace = response.place.name;
                    } else if (this.activePlaceField === 'event' && this.activeEventIndex !== null) {
                        this.modalData.events[this.activeEventIndex].place = response.place.name;
                    } else if (this.activePlaceField === 'family') {
                        this.newFamilyEvent.place = response.place.name;
                    }
                    this.closePlaceModal();
                } else {
                    this.placeErrorMessage = response.message;
                }
            },
            error: (err: any) => {
                this.isSaving = false;
                this.placeErrorMessage = err.error?.message || 'Fehler beim Speichern des Ortes.';
            }
        });
    }
}
