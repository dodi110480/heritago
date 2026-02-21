import { Component, inject, signal, ElementRef, ViewChild, AfterViewInit, HostListener, OnInit, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { GedcomService } from './gedcom.service';
import { AuthService, Tree as AuthServiceTree } from './auth.service';
import { ImageCropper } from './image-cropper';
import { TreeData, Individual, Family, LifeEvent } from './models';
import * as d3 from 'd3';

declare const L: any;

interface HierarchyNode {
    id: string;
    firstName: string;
    lastName: string;
    gender: string;
    dates: string;
    profileImageUrl?: string;
    children?: HierarchyNode[];
}

@Component({
    selector: 'app-tree',
    standalone: true,
    imports: [CommonModule, FormsModule, ImageCropper],
    templateUrl: './tree.html',
    styleUrl: './tree.css'
})
export class Tree implements AfterViewInit, OnInit {
    authService = inject(AuthService);
    private gedcomService = inject(GedcomService);
    private ngZone = inject(NgZone);
    private cdr = inject(ChangeDetectorRef);
    private router = inject(Router);
    private route = inject(ActivatedRoute);
    treeData = signal<TreeData | null>(null);
    isSaving = false;

    // Modal State
    isModalOpen = false;
    modalTitle = '';
    modalMode: 'add' | 'edit' = 'add';
    activeTab: 'basics' | 'events' | 'relations' | 'facts' | 'citations' | 'media' | 'notes' | 'extensions' = 'basics';

    // Family Modal State
    isFamilyModalOpen = false;
    familyModalData: Family = {
        id: '',
        children: [],
        events: []
    };
    newFamilyEvent: LifeEvent = { type: 'MARR', date: '', place: '', description: '', isPrimary: false };
    modalData: any = {
        id: '',
        name: '',
        names: [] as any[],
        gender: 'U',
        isAlive: true,
        email: '',
        relations: [] as any[], // Local UI relations
        events: [] as any[],
        facts: [] as any[],
        citations: [] as any[],
        media: [] as any[],
        extensions: [] as { key: string; value: string }[],
        updatedAt: ''
    };
    activeFamilyTab = 'events';

    newEvent: LifeEvent = { type: 'EVEN', date: '', place: '', description: '', isPrimary: false };

    // Relationship State
    activeRelationIndex: number | null = null;
    showRelationResults = false;
    potentialRelationPersons: Individual[] = [];

    showPlaceResults = false;
    potentialPlaces: any[] = [];
    activePlaceField: 'birth' | 'death' | 'event' | 'family' | 'family-event' = 'birth';
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

    // Validation Feedback State
    showValidationModal = false;
    validationErrors: string[] = [];
    validationWarnings: string[] = [];

    private pendingRelation: { targetId: string, type: string, gender: string } | null = null;

    // Search Results State
    showSearch = false;
    searchResults: any[] = [];

    // Media Chooser State
    showMediaChooser = signal(false);
    libraryMedia = signal<any[]>([]);
    mediaChooserTarget: 'person' | 'family' | 'event' = 'person';
    mediaChooserLoading = signal(false);

    // Cropper state
    showCropper = signal(false);
    cropImageUrl = signal<string | null>(null);
    currentUploadFile = signal<File | null>(null);

    get individuals(): Individual[] {
        return this.treeData()?.individuals || [];
    }

    ngOnInit() {
        // Initial data load already handled or can be done here
    }

    @ViewChild('svgViewport', { static: true }) svgElement!: ElementRef<SVGElement>;

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
                // Transform all media URLs in individuals and families
                if (data.individuals) {
                    data.individuals.forEach(person => {
                        if (person.media) {
                            person.media.forEach((m: any) => m.url = this.gedcomService.getMediaUrl(m.url));
                        }
                    });
                }
                if (data.families) {
                    data.families.forEach(fam => {
                        if (fam.media) {
                            fam.media.forEach((m: any) => m.url = this.gedcomService.getMediaUrl(m.url));
                        }
                    });
                }

                this.treeData.set(data);
                this.renderTree();

                // Check for focus parameter
                this.route.queryParams.subscribe(params => {
                    const focusId = params['focus'];
                    if (focusId) {
                        setTimeout(() => this.focusPerson(focusId), 500);
                    }
                });
            }
        });
    }

    private initSvg() {
        if (!this.svgElement) return;

        this.svg = d3.select(this.svgElement.nativeElement)
            .attr('width', '100%')
            .attr('height', '100%');

        // ClipPath EINMALIG definieren
        if (this.svg.select('#avatarClip').empty()) {
            const defs = this.svg.append('defs');

            defs.append("clipPath")
                .attr("id", "avatarClip")
                .append("circle")
                .attr("r", 30)
                .attr("cx", 30)
                .attr("cy", 30);
        }

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
            const iid = indi.id.trim();
            const famsWhereChild = data.families.filter(f => f.children.some(c => c.trim() === iid));
            if (famsWhereChild.length === 0) return true;

            // If they are a child, check if ANY of their families have parents present in individuals list
            return !famsWhereChild.some(f => {
                const husbandId = f.husband?.trim();
                const wifeId = f.wife?.trim();
                const husbandExists = husbandId && data.individuals.some(i => i.id.trim() === husbandId);
                const wifeExists = wifeId && data.individuals.some(i => i.id.trim() === wifeId);
                return husbandExists || wifeExists;
            });
        });

        console.log(`Initial potential roots: ${potentialRoots.map(r => r.id).join(', ')}`);

        // If a cycle exists, potentialRoots might be empty for a cluster.
        // We ensure EVERY disconnected cluster gets at least one root.
        const clusterRoots: string[] = [...potentialRoots.map(r => r.id)];
        const allIds = new Set(data.individuals.map(i => i.id));
        const coveredByRoots = new Set<string>();

        const findClusterMembers = (id: string, members: Set<string>) => {
            if (members.has(id)) return;
            members.add(id);
            // Add spouses
            data.families.filter(f => f.husband === id || f.wife === id).forEach(f => {
                if (f.husband) findClusterMembers(f.husband, members);
                if (f.wife) findClusterMembers(f.wife, members);
                f.children.forEach(c => findClusterMembers(c, members));
            });
            // Add parents
            data.families.filter(f => f.children.includes(id)).forEach(f => {
                if (f.husband) findClusterMembers(f.husband, members);
                if (f.wife) findClusterMembers(f.wife, members);
            });
        };

        // Mark everyone reachable from identified roots
        clusterRoots.forEach(rid => findClusterMembers(rid, coveredByRoots));

        // For individuals NOT reachable from a root, pick the one with most descendants as a new root
        data.individuals.forEach(indi => {
            if (!coveredByRoots.has(indi.id)) {
                console.warn(`Individual ${indi.id} (${indi.name}) is in a disconnected/cyclic cluster. Picking as new root.`);
                clusterRoots.push(indi.id);
                findClusterMembers(indi.id, coveredByRoots);
            }
        });

        // Pick the actual roots and build hierarchies
        clusterRoots.forEach(rootId => {
            if (!visited.has(rootId)) {
                // Handle spouse logic to keep families together at the root level
                const spouseFam = data.families.find(f => (f.husband === rootId || f.wife === rootId) && f.husband && f.wife);
                if (spouseFam) {
                    const otherId = spouseFam.husband === rootId ? spouseFam.wife! : spouseFam.husband!;
                    if (!visited.has(rootId)) {
                        const node = this.buildHierarchy(rootId, data, visited);
                        if (node) rootNodes.push(node);
                    }
                    if (!visited.has(otherId)) {
                        const node = this.buildHierarchy(otherId, data, visited);
                        if (node) rootNodes.push(node);
                    }
                } else {
                    const node = this.buildHierarchy(rootId, data, visited);
                    if (node) rootNodes.push(node);
                }
            }
        });

        console.log(`Identified ${rootNodes.length} hierarchies for the tree.`);

        // 3. Create a virtual root if there are multiple hierarchies
        let hierarchy: HierarchyNode;
        if (rootNodes.length === 1) {
            hierarchy = rootNodes[0];
        } else {
            hierarchy = {
                id: 'forest-root',
                firstName: 'Stammbaum',
                lastName: '',
                gender: 'U',
                dates: '',
                children: rootNodes
            };
        }

        // 4. Create d3 tree layout
        const root = d3.hierarchy(hierarchy);
        const treeLayout = d3.tree<HierarchyNode>()
            .nodeSize([this.nodeWidth + 60, this.nodeHeight + 120])
            .separation((a, b) => (a.parent === b.parent ? 1 : 1.3));

        treeLayout(root);

        const descendants = root.descendants();
        const nodes_map = new Map(descendants.map(d => [d.data.id, d]));

        // --- 1. Universal Base Leveling ---
        const levelHeight = this.nodeHeight + 140; // Increased vertical gap for cleaner lines (Regel 4)
        descendants.forEach((d: any) => {
            if (d.data.id === 'forest-root') {
                d.y = -levelHeight;
            } else {
                const effectiveDepth = d.data.id === 'forest-root' ? -1 : (d.depth - (hierarchy.id === 'forest-root' ? 1 : 0));
                d.y = effectiveDepth * levelHeight;
            }
        });

        // --- 2. Spouse Sync & Initial X ---
        // Ensure partners share exact same Y.
        data.families.forEach(fam => {
            if (fam.husband && fam.wife) {
                const hNode: any = nodes_map.get(fam.husband);
                const wNode: any = nodes_map.get(fam.wife);
                if (hNode && wNode) {
                    const targetY = Math.max(hNode.y, wNode.y);
                    hNode.y = targetY;
                    wNode.y = targetY;
                }
            }
        });

        // --- 3. Sibling Group Block Processing (Rules 11, 12, 13) ---
        // Process each generation to group children and reserve space for partners.
        const CARD_WIDTH = this.nodeWidth;
        const HORIZONTAL_GAP = 64; // Regel 4: >= 64px
        const PARTNER_GAP = 40;   // Gap between partners in a block

        // 3a. Identify Sibling Groups
        const familiesWithChildren = data.families.filter(f => f.children && f.children.length > 0);
        const usedInBlock = new Set<string>();

        familiesWithChildren.forEach(fam => {
            const childrenNodes = fam.children.map(cid => nodes_map.get(cid)).filter(n => !!n) as any[];
            if (childrenNodes.length === 0) return;

            const blocks: any[] = [];
            childrenNodes.forEach(cNode => {
                if (usedInBlock.has(cNode.data.id)) return;

                const spouseFam = data.families.find(f => (f.husband === cNode.data.id || f.wife === cNode.data.id) && f.husband && f.wife);
                const spouseId = spouseFam ? (spouseFam.husband === cNode.data.id ? spouseFam.wife : spouseFam.husband) : null;
                const spouseNode: any = spouseId ? nodes_map.get(spouseId) : null;

                if (spouseNode && !usedInBlock.has(spouseNode.data.id)) {
                    const baseWidth = 2 * CARD_WIDTH + PARTNER_GAP;


                    blocks.push({
                        type: 'couple',
                        nodes: [cNode, spouseNode],
                        width: 2 * CARD_WIDTH + PARTNER_GAP
                    });
                    usedInBlock.add(cNode.data.id);
                    usedInBlock.add(spouseNode.data.id);
                } else {
                    // Single sibling

                    blocks.push({
                        type: 'single',
                        nodes: [cNode],
                        width: CARD_WIDTH
                    });
                    usedInBlock.add(cNode.data.id);
                }
            });

            // 3b. Center the Group under Parents (Rule 5 & 11)
            const parentH: any = nodes_map.get(fam.husband || '');
            const parentW: any = nodes_map.get(fam.wife || '');
            let parentMidX = 0;
            if (parentH && parentW && parentH.x !== undefined && parentW.x !== undefined) {
                parentMidX = (parentH.x + parentW.x + CARD_WIDTH) / 2;
            } else if (parentH && parentH.x !== undefined) {
                parentMidX = parentH.x + CARD_WIDTH / 2;
            } else if (parentW && parentW.x !== undefined) {
                parentMidX = parentW.x + CARD_WIDTH / 2;
            } else {
                parentMidX = d3.mean(childrenNodes, d => d.x ?? 0) || 0;
            }

            const totalGroupWidth = blocks.reduce((acc, b) => acc + b.width, 0) + (blocks.length - 1) * HORIZONTAL_GAP;
            let currentX = parentMidX - totalGroupWidth / 2;

            blocks.forEach(block => {
                const blockMidX = currentX + block.width / 2;
                const firstNode = block.nodes[0];

                // Position the person (and partner) within the block
                let personTargetX;
                if (block.type === 'couple') {
                    // Couple base width is 2*CARD + PARTNER_GAP
                    // Center the couple within the (potentially wider) block
                    personTargetX = blockMidX - (2 * CARD_WIDTH + PARTNER_GAP) / 2;
                } else {
                    personTargetX = blockMidX - CARD_WIDTH / 2;
                }

                const shiftX = personTargetX - (firstNode.x ?? 0);

                // IMPORTANT: Center descendants under the block midpoint (Rule 11)
                // First, shift the individual so they are positioned correctly in the block
                firstNode.x = personTargetX;

                if (block.type === 'couple') {
                    const secondNode = block.nodes[1];
                    secondNode.x = personTargetX + CARD_WIDTH + PARTNER_GAP;
                    secondNode.y = firstNode.y;
                }

                // Now shift all sub-descendants so they are centered under blockMidX
                // Find sub-descendants (excluding the nodes in the block itself)
                const subtreeRoots = block.nodes;
                subtreeRoots.forEach((root: any) => {
                    const children = root.children || [];
                    children.forEach((child: any) => {
                        // Calculate initial subtree center
                        let minS = Infinity, maxS = -Infinity;
                        child.each((d: any) => {
                            minS = Math.min(minS, d.x ?? 0);
                            maxS = Math.max(maxS, d.x ?? 0);
                        });
                        const currentSubCenter = (minS + maxS + CARD_WIDTH) / 2;
                        const subShift = blockMidX - currentSubCenter;

                        child.each((d: any) => {
                            if (d.x !== undefined) d.x += subShift;
                        });
                    });
                });

                currentX += block.width + HORIZONTAL_GAP;
            });
        });

        // --- 4. Global Collision Resolution (Rule 13) ---
        // Identify all blocks in each generation and resolve collisions between them.
        const yLevels = Array.from(d3.group(descendants.filter(d => d.data.id !== 'forest-root'), (d: any) => d.y ?? 0).keys()).sort((a, b) => a - b);

        yLevels.forEach((y: any) => {
            const nodesAtY = descendants.filter((d: any) => (d.y ?? 0) === y).sort((a, b) => (a.x ?? 0) - (b.x ?? 0));
            const levelBlocks: any[] = [];
            const processed = new Set<string>();

            nodesAtY.forEach(node => {
                if (processed.has(node.data.id)) return;

                // Determine if this node is part of a couple block
                const spouseFam = data.families.find(f => (f.husband === node.data.id || f.wife === node.data.id) && f.husband && f.wife);
                if (spouseFam) {
                    const spouseId = spouseFam.husband === node.data.id ? spouseFam.wife : spouseFam.husband;
                    const spouseNode = nodes_map.get(spouseId || '');
                    if (spouseNode && (spouseNode.y ?? 0) === y) {
                        const blockNodes = [node, spouseNode].sort((a, b) => (a.x ?? 0) - (b.x ?? 0));
                        levelBlocks.push({
                            nodes: blockNodes,
                            minX: blockNodes[0].x ?? 0,
                            maxX: (blockNodes[1].x ?? 0) + CARD_WIDTH
                        });
                        processed.add(node.data.id);
                        processed.add(spouseId!);
                        return;
                    }
                }

                // Single node block
                levelBlocks.push({
                    nodes: [node],
                    minX: node.x ?? 0,
                    maxX: (node.x ?? 0) + CARD_WIDTH
                });
                processed.add(node.data.id);
            });

            // 4b. Group blocks into Sibling Groups (Rule 13)
            const levelGroups: any[] = [];
            let currentGroup: any = null;

            levelBlocks.forEach(block => {
                // Find parent family ID for the first node in the block
                const firstNode = block.nodes[0];
                const famId = data.families.find(f => f.children.includes(firstNode.data.id))?.id || 'root-group';

                if (!currentGroup || currentGroup.famId !== famId) {
                    currentGroup = {
                        famId: famId,
                        blocks: [block],
                        minX: block.minX,
                        maxX: block.maxX
                    };
                    levelGroups.push(currentGroup);
                } else {
                    currentGroup.blocks.push(block);
                    currentGroup.maxX = Math.max(currentGroup.maxX, block.maxX);
                }
            });

            // 4c. Resolve collisions between Sibling Groups
            for (let i = 1; i < levelGroups.length; i++) {
                const prev = levelGroups[i - 1];
                const curr = levelGroups[i];

                const minX = prev.maxX + HORIZONTAL_GAP;
                const currentMinX = curr.minX;

                if (currentMinX < minX) {
                    const shift = minX - currentMinX;
                    curr.blocks.forEach((block: any) => {
                        block.nodes.forEach((node: any) => {
                            node.each((desc: any) => {
                                if (desc.x !== undefined) desc.x += shift;
                            });
                        });
                    });
                    curr.minX += shift;
                    curr.maxX += shift;
                }
            }
        });

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

        node.each((d: any, i: number, nodesArr: any[]) => {
            const gNode = d3.select(nodesArr[i]);

            const avatarX = avatarMargin;
            const avatarY = this.nodeHeight / 2 - avatarSize / 2;

            if (d.data.profileImageUrl) {

                const avatarGroup = gNode.append("g")
                    .attr("transform", `translate(${avatarX}, ${avatarY})`);

                // Kreis-Clip lokal definieren
                avatarGroup.append("defs")
                    .append("clipPath")
                    .attr("id", `clip-${d.data.id}`)
                    .append("circle")
                    .attr("cx", avatarSize / 2)
                    .attr("cy", avatarSize / 2)
                    .attr("r", avatarSize / 2);

                // Weißer Ring (optional aber empfohlen)
                avatarGroup.append("circle")
                    .attr("cx", avatarSize / 2)
                    .attr("cy", avatarSize / 2)
                    .attr("r", avatarSize / 2)
                    .attr("fill", "#ffffff")
                    .attr("stroke", "#e2e8f0")
                    .attr("stroke-width", 2);

                // Bild
                avatarGroup.append("image")
                    .attr("href", d.data.profileImageUrl)
                    .attr("width", avatarSize)
                    .attr("height", avatarSize)
                    .attr("clip-path", `url(#clip-${d.data.id})`)
                    .attr("preserveAspectRatio", "xMidYMid slice");
            } else {
                const avatarGroup = gNode.append("g")
                    .attr("transform", `translate(${avatarX}, ${avatarY})`);

                // Wie auf /persons: abgerundeter Kasten + Outline-Personen-Icon
                const boxFill =
                    d.data.gender === 'M' ? 'rgba(59, 130, 246, 0.15)' :
                        d.data.gender === 'F' ? 'rgba(236, 72, 153, 0.15)' :
                            'rgba(148, 163, 184, 0.15)';
                const iconStroke =
                    d.data.gender === 'M' ? '#60a5fa' :
                        d.data.gender === 'F' ? '#f472b6' :
                            '#94a3b8';

                avatarGroup.append("rect")
                    .attr("width", avatarSize)
                    .attr("height", avatarSize)
                    .attr("rx", 16)
                    .attr("ry", 16)
                    .attr("fill", boxFill);

                const iconScale = avatarSize / 24;
                const iconG = avatarGroup.append("g")
                    .attr("transform", `translate(${avatarSize / 2}, ${avatarSize / 2}) scale(${iconScale}) translate(-12, -12)`);
                iconG.append("path")
                    .attr("d", "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2")
                    .attr("fill", "none")
                    .attr("stroke", iconStroke)
                    .attr("stroke-width", 2);
                iconG.append("circle")
                    .attr("cx", 12)
                    .attr("cy", 7)
                    .attr("r", 4)
                    .attr("fill", "none")
                    .attr("stroke", iconStroke)
                    .attr("stroke-width", 2);
            }
        });

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

                // Deep copy and ensure arrays exist
                this.modalData = JSON.parse(JSON.stringify(person));
                this.modalData.names = this.modalData.names || [];
                this.modalData.events = this.modalData.events || [];
                this.modalData.facts = this.modalData.facts || [];
                this.modalData.citations = this.modalData.citations || [];
                this.modalData.media = this.modalData.media || [];
                this.modalData.notes = this.modalData.notes || [];
                this.modalData.extensions = this.modalData.extensions || [];
                this.modalData.relations = []; // Local UI relations

                // Resolve Names if empty
                if (this.modalData.names.length === 0) {
                    this.modalData.names.push({
                        given: person.firstName || person.name.split(' ')[0],
                        surname: person.lastName || person.name.split(' ').slice(1).join(' '),
                        isPrimary: true,
                        type: 'BIRTH'
                    });
                }

                // Resolve Relationships for the UI
                const relations: any[] = [];
                const pid = person.id.trim().replace(/^@|@$/g, '');

                // Find Parents
                const parentFam = data.families.find(f =>
                    f.children.some(c => c.trim().replace(/^@|@$/g, '') === pid)
                );
                if (parentFam) {
                    if (parentFam.husband) {
                        const h = data.individuals.find(i => i.id.trim().replace(/^@|@$/g, '') === parentFam.husband!.trim().replace(/^@|@$/g, ''));
                        relations.push({ type: 'FATHER', personId: h?.id || parentFam.husband, personName: h?.name || parentFam.husband, searchQuery: h?.name || '' });
                    }
                    if (parentFam.wife) {
                        const w = data.individuals.find(i => i.id.trim().replace(/^@|@$/g, '') === parentFam.wife!.trim().replace(/^@|@$/g, ''));
                        relations.push({ type: 'MOTHER', personId: w?.id || parentFam.wife, personName: w?.name || parentFam.wife, searchQuery: w?.name || '' });
                    }
                }

                // Find Spouses and Children
                data.families.filter(f => (f.husband?.trim().replace(/^@|@$/g, '') === pid || f.wife?.trim().replace(/^@|@$/g, '') === pid)).forEach(fam => {
                    const isHusband = fam.husband?.trim().replace(/^@|@$/g, '') === pid;
                    const spouseId = isHusband ? fam.wife : fam.husband;
                    if (spouseId) {
                        const s = data.individuals.find(i => i.id.trim().replace(/^@|@$/g, '') === spouseId.trim().replace(/^@|@$/g, ''));
                        relations.push({ type: 'SPOUSE', personId: s?.id || spouseId, personName: s?.name || spouseId, searchQuery: s?.name || '' });
                    }
                    fam.children.forEach(cid => {
                        const child = data.individuals.find(i => i.id.trim().replace(/^@|@$/g, '') === cid.trim().replace(/^@|@$/g, ''));
                        relations.push({ type: 'CHILD', personId: child?.id || cid, personName: child?.name || cid, searchQuery: child?.name || '' });
                    });
                });

                this.modalData.relations = relations;
            }
        } else {
            this.modalTitle = 'Neue Person hinzufügen';
            this.modalData = {
                id: '',
                name: '',
                names: [{ given: '', surname: '', isPrimary: true, type: 'BIRTH' }],
                gender: 'U',
                isAlive: true,
                email: '',
                relations: [],
                events: [],
                facts: [],
                citations: [],
                media: [],
                notes: [],
                extensions: [],
            };

            // Handle pending relation from tree add button
            if (this.pendingRelation) {
                const individuals = this.treeData()?.individuals || [];
                const anchorId = this.pendingRelation.targetId;
                const anchor = individuals.find(i => i.id === anchorId);

                if (anchor) {
                    const relTypeMap: any = {
                        'brother': 'SIBLING',
                        'sister': 'SIBLING',
                        'partner': 'SPOUSE',
                        'son': 'CHILD',
                        'daughter': 'CHILD'
                    };

                    this.modalData.gender = this.pendingRelation.gender;
                    this.modalData.relations.push({
                        type: relTypeMap[this.pendingRelation.type] || 'OTHER',
                        personId: anchor.id,
                        personName: anchor.name,
                        searchQuery: anchor.name
                    });
                }
            }
        }
        this.cdr.markForCheck();
    }

    closeModal() {
        this.isModalOpen = false;
        this.pendingRelation = null;
        this.cdr.markForCheck();
    }

    savePerson() {
        // Perform validation on all relationships
        this.validationErrors = [];
        this.validationWarnings = [];
        const relations = this.modalData.relations || [];

        relations.forEach((rel: any) => {
            if (rel.personId) {
                const validation = this.validateRelationship(this.modalData.id, rel.personId, rel.type);
                if (!validation.valid) {
                    this.validationErrors.push(...validation.errors.map(e => `[${this.getRelationLabel(rel.type)}: ${rel.personName}] ${e}`));
                }
                this.validationWarnings.push(...validation.warnings.map(w => `[${this.getRelationLabel(rel.type)}: ${rel.personName}] ${w}`));
            }
        });

        // Add general validation
        const primaryName = this.modalData.names.find((n: any) => n.isPrimary) || this.modalData.names[0];
        if (!primaryName || (!primaryName.given && !primaryName.surname)) {
            this.validationErrors.push('Bitte geben Sie mindestens einen Vornamen oder Nachnamen an.');
        }

        if (this.validationErrors.length > 0 || this.validationWarnings.length > 0) {
            this.showValidationModal = true;
            this.cdr.markForCheck();
            return;
        }

        // If no issues at all, proceed immediately
        this.proceedWithSave();
    }

    proceedWithSave() {
        const data = this.treeData();
        if (!data || this.isSaving) return;

        this.showValidationModal = false;
        this.isSaving = true;

        const targetId = this.pendingRelation?.targetId;
        const relationType = this.pendingRelation?.type;

        const relations = this.modalData.relations || [];
        const father = relations.find((r: any) => r.type === 'FATHER');
        const mother = relations.find((r: any) => r.type === 'MOTHER');
        const spouse = relations.find((r: any) => r.type === 'SPOUSE');

        const payload = {
            mode: this.modalMode,
            id: this.modalData.id,
            name: this.modalData.name,
            names: this.modalData.names,
            gender: this.modalData.gender,
            isAlive: this.modalData.isAlive,
            email: this.modalData.email,
            relations: relations,
            events: this.modalData.events,
            facts: this.modalData.facts,
            citations: this.modalData.citations,
            media: this.modalData.media,
            notes: this.modalData.notes,
            extensions: this.modalData.extensions,
            targetId: targetId,
            relationType: relationType
        };

        console.log('Sending Save Payload:', payload);

        const activeTree = this.authService.currentTree() as any;
        const treeName = activeTree?.name || this.treeData()?.meta?.tree || 'sperlich';

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

    familyEventLabels: { [key: string]: string } = {
        'MARR': 'Hochzeit',
        'DIV': 'Scheidung',
        'ENGA': 'Verlobung',
        'MARC': 'Ehevertrag',
        'MARS': 'Eheversprechen',
        'EVEN': 'Ereignis (Sonstige)',
        'ANUL': 'Annullierung',
        'MARB': 'Aufgebot',
        'MARL': 'Heiratslizenz'
    };

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
        this.familyModalData.events.push({
            type: 'MARR',
            date: '',
            place: '',
            description: '',
            isPrimary: false
        });
    }

    removeFamilyEvent(index: number) {
        if (this.familyModalData.events) {
            this.familyModalData.events.splice(index, 1);
        }
    }

    addFamilyMedia() {
        this.openMediaChooser('family');
    }

    removeFamilyMedia(index: number) {
        if (this.familyModalData.media) {
            this.familyModalData.media.splice(index, 1);
        }
    }

    saveFamily() {
        if (this.isSaving) return;
        this.isSaving = true;

        const treeName = this.treeData()?.meta?.tree || 'sperlich';

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

        const primaryName = this.modalData.names.find((n: any) => n.isPrimary) || this.modalData.names[0];
        const personName = primaryName ? `${primaryName.given} ${primaryName.surname}` : (this.modalData.name || 'diese Person');

        if (!confirm(`Möchten Sie ${personName} wirklich löschen?`)) {
            return;
        }

        const activeTree = this.authService.currentTree() as any;
        const treeName = activeTree?.name || data?.meta?.tree || 'sperlich';

        this.gedcomService.deletePerson(treeName, this.modalData.id).subscribe({
            next: () => {
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

    private buildHierarchy(rootId: string, data: TreeData, visited: Set<string>): HierarchyNode | null {
        const indi = data.individuals.find(i => i.id === rootId);
        let profileImageUrl: string | undefined;
        if (indi?.media && indi.media.length > 0) {
            const primary = indi.media.find((m: any) => m.isPrimary);
            const img = primary || indi.media[0];
            if (img?.url) {
                profileImageUrl = img.url;
            }
        }
        if (!indi) {
            return null;
        }

        visited.add(rootId);

        let firstName = indi.firstName || '';
        let lastName = indi.lastName || '';

        if (!firstName && !lastName && indi.name) {
            const fullName = this.stripHtml(indi.name);
            if (fullName !== 'undefined') {
                const nameParts = fullName.split(' ');
                lastName = nameParts.length > 1 ? (nameParts.pop() || '') : '';
                firstName = nameParts.join(' ');
            }
        }

        const node: HierarchyNode = {
            id: indi.id,
            firstName: firstName,
            lastName: lastName,
            gender: indi.gender,
            dates: `${this.stripHtml(indi.birthDate || '')} - ${this.stripHtml(indi.deathDate || '')}`.trim().replace(/^undefined - undefined$/, ''),
            profileImageUrl: profileImageUrl,
            children: []
        };
        if (node.dates === '-') node.dates = '';

        const parentFamilies = data.families.filter(f => f.husband === rootId || f.wife === rootId);
        parentFamilies.forEach(fam => {
            fam.children.forEach(childId => {
                if (!visited.has(childId)) {
                    const childNode = this.buildHierarchy(childId, data, visited);
                    if (childNode) {
                        node.children?.push(childNode);
                    }
                }
            });
        });

        if (node.children?.length === 0) {
            delete node.children;
        }

        return node;
    }

    private stripHtml(html: string | undefined | null): string {
        if (!html) return '';
        const tmp = document.createElement('DIV');
        tmp.innerHTML = html;
        const text = tmp.textContent || tmp.innerText || '';
        return text === 'undefined' ? '' : text;
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

    // --- Tab Management ---
    setActiveTab(tab: any) {
        this.activeTab = tab;
        this.cdr.markForCheck();
    }

    // --- UI Helpers for Modal Arrays ---
    addNameRow() {
        this.modalData.names.push({ given: '', surname: '', isPrimary: false, type: 'AKA' });
    }
    removeNameRow(index: number) {
        this.modalData.names.splice(index, 1);
    }
    setPrimaryName(index: number) {
        this.modalData.names.forEach((n: any, i: number) => n.isPrimary = (i === index));
    }

    addEvent() {
        if (!this.modalData.events) this.modalData.events = [];
        this.modalData.events.push({ ...this.newEvent });
        this.newEvent = { type: 'EVEN', date: '', place: '', description: '', isPrimary: false };
    }
    removeEvent(index: number) {
        this.modalData.events.splice(index, 1);
    }

    addFact() {
        if (!this.modalData.facts) this.modalData.facts = [];
        this.modalData.facts.push({ type: 'OCCU', value: '', description: '' });
    }
    removeFact(index: number) {
        this.modalData.facts.splice(index, 1);
    }

    addCitation() {
        if (!this.modalData.citations) this.modalData.citations = [];
        this.modalData.citations.push({ source: '', page: '', quality: '3', text: '' });
    }
    removeCitation(index: number) {
        this.modalData.citations.splice(index, 1);
    }

    addMedia() {
        this.openMediaChooser('person');
    }
    removeMedia(index: number) {
        this.modalData.media.splice(index, 1);
    }

    // Media Chooser Methods
    openMediaChooser(target: 'person' | 'family' | 'event') {
        this.mediaChooserTarget = target;
        this.showMediaChooser.set(true);
        this.loadLibraryMedia();
    }

    loadLibraryMedia() {
        this.mediaChooserLoading.set(true);
        const treeId = this.treeData()?.meta?.treeId || this.authService.currentTree()?.id;
        if (!treeId) {
            this.mediaChooserLoading.set(false);
            return;
        }

        this.gedcomService.getMedia(treeId).subscribe({
            next: (res: any) => {
                const items = (res.media || []).map((m: any) => ({
                    ...m,
                    url: this.gedcomService.getMediaUrl(m.url)
                }));
                this.libraryMedia.set(items);
                this.mediaChooserLoading.set(false);
                this.cdr.markForCheck();
            },
            error: () => {
                this.mediaChooserLoading.set(false);
                this.cdr.markForCheck();
            }
        });
    }

    selectMediaForResult(item: any) {
        const targetObj = this.mediaChooserTarget === 'person' ? this.modalData : this.familyModalData;
        if (!targetObj.media) targetObj.media = [];

        // Check if already linked
        if (targetObj.media.find((m: any) => m.id === item.id)) {
            this.showMediaChooser.set(false);
            return;
        }

        targetObj.media.push({
            id: item.id,
            url: item.url,
            title: item.title || item.originalFileName,
            isPrimary: false,
            mimeType: item.mimeType
        });

        this.showMediaChooser.set(false);
        this.cdr.markForCheck();
    }

    onMediaUploadInModal(event: any) {
        const file = event.target.files[0];
        if (!file) return;

        if (file.type.startsWith('image/')) {
            this.currentUploadFile.set(file);
            const reader = new FileReader();
            reader.onload = (e: any) => {
                this.cropImageUrl.set(e.target.result);
                this.showCropper.set(true);
            };
            reader.readAsDataURL(file);
        } else {
            this.proceedWithUpload(file);
        }
    }

    onCropped(blob: Blob) {
        this.showCropper.set(false);
        const originalFile = this.currentUploadFile()!;
        const croppedFile = new File([blob], originalFile.name.replace(/\.[^/.]+$/, "") + ".webp", { type: 'image/webp' });
        this.proceedWithUpload(croppedFile);
    }

    proceedWithUpload(file: File) {
        const treeId = this.treeData()?.meta?.treeId || this.authService.currentTree()?.id;
        if (!treeId) return;

        this.mediaChooserLoading.set(true);
        this.gedcomService.uploadMedia(treeId, file).subscribe({
            next: (res: any) => {
                // Transform URL of the new media
                if (res.media) {
                    res.media.url = this.gedcomService.getMediaUrl(res.media.url);
                }
                this.selectMediaForResult(res.media);
                this.mediaChooserLoading.set(false);
                this.cdr.markForCheck();
            },
            error: (err) => {
                console.error('Modal upload failed', err);
                this.mediaChooserLoading.set(false);
                this.cdr.markForCheck();
            }
        });
    }

    addNote() {
        if (!this.modalData.notes) this.modalData.notes = [];
        this.modalData.notes.push('');
    }
    removeNote(index: number) {
        this.modalData.notes.splice(index, 1);
    }

    addExtension() {
        if (!this.modalData.extensions) this.modalData.extensions = [];
        this.modalData.extensions.push({ key: '', value: '' });
    }
    removeExtension(index: number) {
        this.modalData.extensions.splice(index, 1);
    }

    addRelationRow() {
        if (!this.modalData.relations) this.modalData.relations = [];
        this.modalData.relations.push({ type: 'SPOUSE', personId: '', personName: '', searchQuery: '' });
    }
    removeRelation(index: number) {
        this.modalData.relations.splice(index, 1);
    }

    // --- Relationship Management ---
    getRelationPlaceholder(type: string): string {
        switch (type) {
            case 'FATHER': return 'Vater suchen...';
            case 'MOTHER': return 'Mutter suchen...';
            case 'SPOUSE': return 'Partner suchen...';
            case 'CHILD': return 'Kind suchen...';
            case 'SIBLING': return 'Geschwister suchen...';
            default: return 'Person suchen...';
        }
    }

    getRelationLabel(type: string): string {
        switch (type) {
            case 'FATHER': return 'Vater';
            case 'MOTHER': return 'Mutter';
            case 'SPOUSE': return 'Partner/in';
            case 'CHILD': return 'Kind';
            case 'SIBLING': return 'Geschwister';
            default: return 'Unbekannt';
        }
    }

    searchPersonForRelation(index: number, query: string) {
        this.activeRelationIndex = index;
        if (!query || query.length < 2) {
            this.potentialRelationPersons = [];
            this.showRelationResults = false;
            return;
        }

        const data = this.treeData();
        if (!data) return;

        this.potentialRelationPersons = data.individuals.filter(i =>
            i.name.toLowerCase().includes(query.toLowerCase()) &&
            i.id !== this.modalData.id
        ).slice(0, 10);

        this.showRelationResults = true;
    }

    selectPersonForRelation(index: number, person: Individual) {
        const rel = this.modalData.relations[index];
        if (!rel) return;

        const validation = this.validateRelationship(this.modalData.id, person.id, rel.type);
        if (!validation.valid) {
            alert('Aktion nicht möglich:\n' + validation.errors.join('\n'));
            return;
        }

        if (validation.warnings.length > 0) {
            if (!confirm('Warnung - Möchten Sie trotzdem fortfahren?\n\n' + validation.warnings.join('\n'))) {
                return;
            }
        }

        rel.personId = person.id;
        rel.personName = person.name;
        rel.searchQuery = person.name;
        this.showRelationResults = false;
        this.activeRelationIndex = null;
    }

    createNewPersonForRelation(index: number) {
        const rel = this.modalData.relations[index];
        if (!rel) return;

        const query = rel.searchQuery;
        const type = rel.type.toLowerCase();

        if (confirm(`Möchten Sie eine neue Person (${query}) als "${type}" erstellen?`)) {
            this.pendingRelation = {
                targetId: this.modalData.id,
                type: type,
                gender: rel.type === 'FATHER' ? 'M' : (rel.type === 'MOTHER' ? 'F' : 'U')
            };

            this.openModal('add');

            if (query) {
                const parts = query.trim().split(' ');
                if (parts.length > 1) {
                    const ln = parts.pop() || '';
                    const fn = parts.join(' ');
                    this.modalData.names = [{ given: fn, surname: ln, isPrimary: true, type: 'BIRTH' }];
                } else {
                    this.modalData.names = [{ given: query, surname: '', isPrimary: true, type: 'BIRTH' }];
                }
            }
        }
    }

    private validateRelationship(personId: string, candidateId: string, type: string): { valid: boolean, errors: string[], warnings: string[] } {
        const errors: string[] = [];
        const warnings: string[] = [];
        const data = this.treeData();
        if (!data) return { valid: true, errors, warnings };

        const candidate = data.individuals.find(i => i.id === candidateId);
        if (!candidate) return { valid: true, errors, warnings };

        const pBirth = this.getYear(this.modalData.birthDate);
        const pDeath = this.getYear(this.modalData.deathDate);
        const cBirth = this.getYear(candidate.birthDate);
        const cDeath = this.getYear(candidate.deathDate);

        if (personId && candidateId) {
            const pid = personId.trim();
            const cid = candidateId.trim();

            if (type === 'FATHER' || type === 'MOTHER') {
                if (this.isDescendantOf(cid, pid, new Set())) {
                    errors.push('Diese Person ist bereits ein Nachfahre von Ihnen.');
                }
                if (pid === cid) {
                    errors.push('Man kann nicht sein eigener Elternteil sein.');
                }
            } else if (type === 'CHILD') {
                if (this.isAncestorOf(cid, pid, new Set())) {
                    errors.push('Diese Person ist bereits ein Vorfahre von Ihnen.');
                }
                if (pid === cid) {
                    errors.push('Man kann nicht sein eigenes Kind sein.');
                }
            }
        }

        if (type === 'FATHER' && candidate.gender === 'F') {
            warnings.push('Der Vater ist als weiblich markiert.');
        } else if (type === 'MOTHER' && candidate.gender === 'M') {
            warnings.push('Die Mutter ist als männlich markiert.');
        }

        if (pBirth && cBirth) {
            const ageDiff = pBirth - cBirth;
            if (type === 'FATHER' || type === 'MOTHER') {
                if (ageDiff < 14) warnings.push(`Biologisch unwahrscheinlich: Der Elternteil wäre bei der Geburt nur ${ageDiff} Jahre alt.`);
                if (ageDiff > 70) warnings.push(`Biologisch unwahrscheinlich: Der Elternteil wäre bei der Geburt bereits ${ageDiff} Jahre alt.`);
                if (ageDiff < 0) errors.push('Ein Elternteil muss vor dem Kind geboren sein.');
            } else if (type === 'CHILD') {
                const childAgeDiff = cBirth - pBirth;
                if (childAgeDiff < 14) warnings.push(`Biologisch unwahrscheinlich: Sie wären bei der Geburt des Kindes erst ${childAgeDiff} Jahre alt.`);
                if (childAgeDiff < 0) errors.push('Ein Kind muss nach dem Elternteil geboren sein.');
            }
        }

        if (pBirth && cDeath) {
            if (type === 'FATHER' && pBirth > cDeath + 1) {
                warnings.push('Der Vater verstarb mehr als 9 Monate vor der Geburt.');
            } else if (type === 'MOTHER' && pBirth > cDeath) {
                errors.push('Die Mutter verstarb vor der Geburt.');
            }
        }

        if (pDeath && cBirth) {
            if (type === 'CHILD' && cBirth > pDeath + (this.modalData.gender === 'M' ? 1 : 0)) {
                errors.push('Das Kind wurde nach Ihrem Tod geboren.');
            }
        }

        return { valid: errors.length === 0, errors, warnings };
    }

    private isAncestorOf(personId: string, potentialDescendantId: string, visited: Set<string>): boolean {
        const pid = personId.trim();
        const tid = potentialDescendantId.trim();
        if (visited.has(pid)) return false;
        visited.add(pid);

        const data = this.treeData();
        if (!data) return false;

        const parentFams = data.families.filter(f => (f.husband?.trim() === pid) || (f.wife?.trim() === pid));

        for (const fam of parentFams) {
            if (fam.children.some(c => c.trim() === tid)) return true;
            for (const childId of fam.children) {
                if (this.isAncestorOf(childId, tid, visited)) return true;
            }
        }
        return false;
    }

    private isDescendantOf(personId: string, potentialAncestorId: string, visited: Set<string>): boolean {
        const pid = personId.trim();
        const aid = potentialAncestorId.trim();
        if (visited.has(pid)) return false;
        visited.add(pid);

        const data = this.treeData();
        if (!data) return false;

        const childFams = data.families.filter(f => f.children.some(c => c.trim() === pid));

        for (const fam of childFams) {
            if (fam.husband?.trim() === aid || fam.wife?.trim() === aid) return true;
            if (fam.husband && this.isDescendantOf(fam.husband, aid, visited)) return true;
            if (fam.wife && this.isDescendantOf(fam.wife, aid, visited)) return true;
        }
        return false;
    }

    private getYear(dateStr?: string): number | null {
        if (!dateStr) return null;
        const match = dateStr.match(/\d{4}/);
        return match ? parseInt(match[0], 10) : null;
    }

    // --- Place Management ---
    searchPlaces(query: string, field: 'birth' | 'death' | 'event' | 'family' | 'family-event', eventIndex: number | null = null) {
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
        const field = this.activePlaceField as string;
        const idx = this.activeEventIndex;

        if (field === 'birth') {
            const birthEvent = this.modalData.events.find((e: any) => e.type === 'BIRT' || e.type === 'BIRTH');
            if (birthEvent) birthEvent.place = place.name;
            else this.modalData.events.push({ type: 'BIRT', date: '', place: place.name, isPrimary: true });
        } else if (field === 'death') {
            const deathEvent = this.modalData.events.find((e: any) => e.type === 'DEAT' || e.type === 'DEATH');
            if (deathEvent) deathEvent.place = place.name;
            else this.modalData.events.push({ type: 'DEAT', date: '', place: place.name, isPrimary: true });
        } else if (field === 'event' && idx !== null) {
            this.modalData.events[idx].place = place.name;
        } else if (field === 'family') {
            this.newFamilyEvent.place = place.name;
        } else if (field === 'family-event' && idx !== null) {
            if (this.familyModalData.events && this.familyModalData.events[idx]) {
                this.familyModalData.events[idx].place = place.name;
            }
        }
        this.showPlaceResults = false;
    }

    openPlaceModal(prefill: string = '') {
        this.placeErrorMessage = '';
        const parts = prefill.split(',').map(p => p.trim());
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
        ].filter(p => p).join(', ');

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
                    const field = this.activePlaceField;
                    const idx = this.activeEventIndex;

                    if (field === 'birth') {
                        const b = this.modalData.events.find((e: any) => e.type === 'BIRT' || e.type === 'BIRTH');
                        if (b) b.place = response.place.name;
                        else this.modalData.events.push({ type: 'BIRT', date: '', place: response.place.name, isPrimary: true });
                    } else if (field === 'death') {
                        const d = this.modalData.events.find((e: any) => e.type === 'DEAT' || e.type === 'DEATH');
                        if (d) d.place = response.place.name;
                        else this.modalData.events.push({ type: 'DEAT', date: '', place: response.place.name, isPrimary: true });
                    } else if (field === 'event' && idx !== null) {
                        this.modalData.events[idx].place = response.place.name;
                    } else if (field === 'family') {
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

    // --- New Helpers & Search ---

    trackByIndex(index: number, item: any): any {
        return index;
    }

    searchTree(query: string) {
        if (!query || query.length < 2) {
            this.searchResults = [];
            return;
        }
        const q = query.toLowerCase();
        this.searchResults = this.individuals
            .filter((p: any) => (p.name || '').toLowerCase().includes(q))
            .slice(0, 10);
    }

    focusPerson(id: string) {
        this.showSearch = false;
        // Search in SVG for the node with this ID
        const node = d3.selectAll('.node').filter(function (d: any) {
            return d.id === id;
        });

        if (!node.empty()) {
            const d: any = node.datum();
            const svg: any = this.svgElement.nativeElement;
            const width = svg.clientWidth;
            const height = svg.clientHeight;

            d3.select(svg).transition().duration(750).call(
                this.zoom.transform,
                d3.zoomIdentity.translate(width / 2 - d.x, height / 2 - d.y).scale(1)
            );
        }
    }
}
