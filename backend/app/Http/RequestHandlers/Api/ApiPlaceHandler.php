<?php

declare(strict_types=1);

namespace Fisharebest\Webtrees\Http\RequestHandlers\Api;

use Fisharebest\Webtrees\DB;
use Fisharebest\Webtrees\Registry;
use Fisharebest\Webtrees\Services\GedcomImportService;
use Fisharebest\Webtrees\Services\TreeService;
use Fisharebest\Webtrees\Tree;
use Fisharebest\Webtrees\PlaceLocation;
use Fisharebest\Webtrees\Place;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

use function count;
use function explode;
use function json_encode;
use function preg_quote;
use function preg_replace;
use function response;
use function str_starts_with;

use const JSON_THROW_ON_ERROR;

class ApiPlaceHandler implements RequestHandlerInterface
{
    public function __construct(
        private readonly TreeService $tree_service,
        private readonly GedcomImportService $gedcom_import_service,
    ) {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $tree_attr = $request->getAttribute('tree');
        $tree = ($tree_attr instanceof Tree) ? $tree_attr : $this->tree_service->all()->get($tree_attr);

        if (!$tree) {
            return Registry::responseFactory()->response(['success' => false, 'message' => 'Tree not found'], 404);
        }

        if ($request->getMethod() === 'GET') {
            return $this->handleGet($tree);
        }

        $params = (array) $request->getParsedBody();
        $mode = $params['mode'] ?? 'save';

        if ($mode === 'delete') {
            return $this->handleDelete($tree, $params);
        }

        return $this->handleSave($tree, $params);
    }

    private function handleGet(Tree $tree): ResponseInterface
    {
        // Fetch all unique places for this tree
        $allPlaces = DB::table('places')
            ->where('p_file', '=', $tree->id())
            ->get()
            ->map(function ($row) use ($tree) {
                $p = Place::find((int) $row->p_id, $tree);
                $location = new PlaceLocation($p->gedcomName());

                return [
                    'id' => $row->p_id,
                    'name' => $p->gedcomName(),
                    'latitude' => $location->latitude(),
                    'longitude' => $location->longitude(),
                ];
            })
            ->unique('name')
            ->values()
            ->all();

        // Filter to keep only "leaf" places (the most specific ones)
        // A place is a parent if another longer place ends with ", " + its name
        $leafPlaces = [];
        // Sort by length descending so we check more specific ones first
        usort($allPlaces, fn($a, $b) => strlen($b['name']) <=> strlen($a['name']));

        $processedNames = [];
        foreach ($allPlaces as $p) {
            $isParent = false;
            foreach ($processedNames as $processed) {
                if (str_ends_with($processed, ", " . $p['name'])) {
                    $isParent = true;
                    break;
                }
            }
            // Logic: if we haven't seen a longer version that contains this as a suffix, it's a leaf for now.
            if (!$isParent) {
                $leafPlaces[] = $p;
                $processedNames[] = $p['name'];
            }
        }

        // Sort alphabetically for display
        usort($leafPlaces, fn($a, $b) => $a['name'] <=> $b['name']);

        return Registry::responseFactory()->response([
            'success' => true,
            'places' => $leafPlaces
        ]);
    }

    private function handleSave(Tree $tree, array $params): ResponseInterface
    {
        $placeName = $params['name'] ?? '';
        $oldName = $params['old_name'] ?? null;

        if (!$placeName) {
            return Registry::responseFactory()->response(['success' => false, 'message' => 'Place name required'], 400);
        }

        // GEDCOM Check
        if (!$this->isGedcomCompliant($placeName)) {
            return Registry::responseFactory()->response([
                'success' => false,
                'message' => 'Der Ortsname muss genau 5 Hierarchiestufen haben (getrennt durch 4 Kommas). Format: "Detail, Stadt, Kreis, Bundesland, Land". Wenn eine Ebene fehlt, lassen Sie sie leer (z.B. ", , Coburg, Bayern, Deutschland").'
            ], 400);
        }

        // Handle Rename if old_name is provided and different
        if ($oldName && $oldName !== $placeName) {
            $this->renamePlaceGlobally($tree, $oldName, $placeName);
        }

        $latitude = $params['latitude'] ?? null;
        $longitude = $params['longitude'] ?? null;

        // This ensures the place exists in the 'places' table for this tree
        // and recursively creates all parent places.
        $p = new Place($placeName, $tree);
        $tempP = $p;
        while ($tempP->id() !== 0) {
            $tempP = $tempP->parent();
        }

        $location = new PlaceLocation($placeName);
        $locationId = $location->id();

        if ($locationId !== null) {
            $update = [];
            if ($latitude !== null) {
                $update['latitude'] = ($latitude === '') ? null : (float) $latitude;
            }
            if ($longitude !== null) {
                $update['longitude'] = ($longitude === '') ? null : (float) $longitude;
            }

            if (!empty($update)) {
                DB::table('place_location')
                    ->where('id', '=', $locationId)
                    ->update($update);
            }
        }

        return response(json_encode([
            'success' => true,
            'place' => [
                'name' => $placeName,
                'latitude' => $latitude,
                'longitude' => $longitude,
            ]
        ], JSON_THROW_ON_ERROR))
            ->withHeader('Content-Type', 'application/json');
    }

    private function isGedcomCompliant(string $placeName): bool
    {
        // Enforce a 5-level hierarchy: Detail, City, District, Region, Country
        // This means there must be 4 commas.
        // Users can leave fields empty like ", , Coburg, Bayern, Deutschland"

        $parts = explode(',', $placeName);
        $count = count($parts);

        // We require exactly 5 parts (4 commas)
        return $count === 5;
    }

    private function handleDelete(Tree $tree, array $params): ResponseInterface
    {
        try {
            $placeName = $params['name'] ?? '';

            if (!$placeName) {
                return Registry::responseFactory()->response(['success' => false, 'message' => 'Place name required for deletion'], 400);
            }

            // Find the correct ID for this full name
            $placeId = $this->resolvePlaceId($tree, $placeName);

            if (!$placeId) {
                return Registry::responseFactory()->response(['success' => false, 'message' => 'Place not found in your tree.'], 404);
            }

            // 1. Remove this place from all Individuals and Families
            $countExIn = $this->removePlaceReferences($tree, $placeName, $placeId);

            // 2. Delete the record from the index
            DB::table('places')
                ->where('p_id', '=', $placeId)
                ->where('p_file', '=', $tree->id())
                ->delete();

            return Registry::responseFactory()->response([
                'success' => true,
                'message' => 'Place removed from tree and updated in ' . $countExIn . ' records.'
            ]);
        } catch (\Throwable $e) {
            return Registry::responseFactory()->response([
                'success' => false,
                'message' => 'Error: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Resolves the database ID for a full hierarchical name.
     */
    private function resolvePlaceId(Tree $tree, string $fullName): ?int
    {
        $parts = array_map('trim', explode(',', $fullName));
        $parts = array_reverse($parts);

        $parentId = 0;
        $lastId = null;

        foreach ($parts as $part) {
            $row = DB::table('places')
                ->where('p_file', '=', $tree->id())
                ->where('p_place', '=', $part)
                ->where('p_parent_id', '=', $parentId)
                ->first();

            if (!$row) {
                return null;
            }

            $parentId = $row->p_id;
            $lastId = $row->p_id;
        }

        return $lastId === null ? null : (int) $lastId;
    }

    /**
     * Finds all records using $placeName and removes the PLAC tag.
     */
    private function removePlaceReferences(Tree $tree, string $placeName, int $placeId): int
    {
        // Use the calculated placeId from the resolver
        $links = DB::table('placelinks')
            ->where('pl_file', '=', $tree->id())
            ->where('pl_p_id', '=', $placeId)
            ->get();

        $processedXrefs = [];
        $count = 0;

        foreach ($links as $link) {
            $xref = $link->pl_gid; // e.g. I1
            if (isset($processedXrefs[$xref])) {
                continue;
            }
            $processedXrefs[$xref] = true;

            $rec = null;
            if (str_starts_with($xref, 'I')) {
                $rec = DB::table('individuals')->where('i_file', $tree->id())->where('i_id', $xref)->value('i_gedcom');
            } elseif (str_starts_with($xref, 'F')) {
                $rec = DB::table('families')->where('f_file', $tree->id())->where('f_id', $xref)->value('f_gedcom');
            }

            if ($rec) {
                // We only want to remove the NAME of the place, not the line itself
                // to prevent the event (like MARR) from becoming "empty" and being pruned.
                $escapedName = preg_quote($placeName, '/');
                $pattern = '/^(2 PLAC )' . $escapedName . '/m';

                $newGedcom = preg_replace($pattern, '$1', $rec);

                if ($newGedcom !== $rec) {
                    $this->gedcom_import_service->updateRecord($newGedcom, $tree, false);
                    $count++;
                }
            }
        }

        return $count;
    }

    /**
     * Finds all links to oldName and updates them to newName
     */
    private function renamePlaceGlobally(Tree $tree, string $oldName, string $newName): int
    {
        $placeId = DB::table('places')
            ->where('p_file', '=', $tree->id())
            ->where('p_place', '=', $oldName)
            ->value('p_id');

        if (!$placeId) {
            return 0;
        }

        $links = DB::table('placelinks')
            ->where('pl_file', '=', $tree->id())
            ->where('pl_p_id', '=', $placeId)
            ->get();

        $processedXrefs = [];
        $count = 0;

        foreach ($links as $link) {
            $xref = $link->pl_gid;
            if (isset($processedXrefs[$xref])) {
                continue;
            }
            $processedXrefs[$xref] = true;

            $rec = null;
            if (str_starts_with($xref, 'I')) {
                $rec = DB::table('individuals')->where('i_file', $tree->id())->where('i_id', $xref)->value('i_gedcom');
            } elseif (str_starts_with($xref, 'F')) {
                $rec = DB::table('families')->where('f_file', $tree->id())->where('f_id', $xref)->value('f_gedcom');
            }

            if ($rec) {
                // Regex to rename: '2 PLAC Old' -> '2 PLAC New'
                $escapedOld = preg_quote($oldName, '/');
                $pattern = '/^(2 PLAC )' . $escapedOld . '(\r?\n|$)/m';
                $replacement = '${1}' . $newName . '$2';

                $newGedcom = preg_replace($pattern, $replacement, $rec);

                if ($newGedcom && $newGedcom !== $rec) {
                    $this->gedcom_import_service->updateRecord($newGedcom, $tree, false);
                    $count++;
                }
            }
        }

        // Remove old index entry as it is now likely orphaned
        DB::table('places')
            ->where('p_file', '=', $tree->id())
            ->where('p_place', '=', $oldName)
            ->delete();

        return $count;
    }
}
