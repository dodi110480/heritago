<?php

declare(strict_types=1);

namespace Fisharebest\Webtrees\Http\RequestHandlers\Api;

use Fisharebest\Webtrees\DB;
use Fisharebest\Webtrees\Individual;
use Fisharebest\Webtrees\Place;
use Fisharebest\Webtrees\PlaceLocation;
use Fisharebest\Webtrees\Registry;
use Fisharebest\Webtrees\Services\TreeService;
use Fisharebest\Webtrees\Tree;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

use function array_diff;
use function array_values;
use function explode;
use function json_encode;
use function response;
use function strip_tags;
use function trim;

use const JSON_THROW_ON_ERROR;

class ApiMapHandler implements RequestHandlerInterface
{
    public function __construct(
        private readonly TreeService $tree_service,
    ) {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $tree_attr = $request->getAttribute('tree');
        $tree = ($tree_attr instanceof Tree) ? $tree_attr : $this->tree_service->all()->get((int) $tree_attr);

        if (!$tree) {
            foreach ($this->tree_service->all() as $t) {
                if ($t->name() === $tree_attr || $t->title() === $tree_attr) {
                    $tree = $t;
                    break;
                }
            }
        }

        if (!$tree) {
            return Registry::responseFactory()->response([
                'success' => false,
                'message' => 'Tree not found',
            ], 404);
        }

        // 1. Get all unique places used in this tree
        $treePlaces = DB::table('places')
            ->where('p_file', '=', $tree->id())
            ->pluck('p_place')
            ->unique();

        // 2. Get all known locations with coordinates
        // We fetch all locations because we don't know which parts of the hierarchy might be used
        $allLocations = DB::table('place_location')
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->get();

        // Map locations by place name for fast lookup
        $locationMap = [];
        foreach ($allLocations as $loc) {
            $locationMap[$loc->place] = [
                'lat' => $loc->latitude,
                'lng' => $loc->longitude
            ];
        }

        $markers = [];
        $added = []; // To avoid duplicate markers for the same coordinate+name combo

        foreach ($treePlaces as $placeName) {
            if (empty($placeName))
                continue;

            $foundLoc = null;
            $searchName = $placeName;

            // Try exact match first
            if (isset($locationMap[$searchName])) {
                $foundLoc = $locationMap[$searchName];
            } else {
                // Hierarchical fallback: "Krankenhaus, Coburg, Bayern" -> "Coburg, Bayern" -> "Bayern"
                $parts = explode(',', $placeName);
                while (count($parts) > 1) {
                    array_shift($parts); // Remove first part
                    $parentName = implode(',', $parts);
                    // Trim spaces usually needed after implode if comma separated with space
                    $parentName = trim($parentName);
                    // But wait, explode might leave spaces. 
                    // Let's re-explode and trim each part to be safe, then reconstruct?
                    // Or just trim the result. Usually " A, B" -> explode -> [" A", " B"].
                    // Actually, let's keep it simple: trim the key.

                    // Actually, simpler logic:
                    // $parts = array_map('trim', explode(',', $placeName));
                    // Then rebuild.

                    // Let's stick to the raw string if possible, assuming consistency.
                    // But inconsistent spacing "A,B" vs "A, B" is common. 
                    // The DB usually stores normalized names?
                    // Let's just try trimming.

                    if (isset($locationMap[$parentName])) {
                        $foundLoc = $locationMap[$parentName];
                        break;
                    }

                    // Also try with spaces trimmed
                    $trimmedParent = implode(', ', array_map('trim', explode(',', $parentName)));
                    if (isset($locationMap[$trimmedParent])) {
                        $foundLoc = $locationMap[$trimmedParent];
                        break;
                    }
                }
            }

            if ($foundLoc) {
                $specificName = trim(explode(',', $placeName)[0]);

                // key to avoid exact duplicates
                $key = $specificName . '|' . $foundLoc['lat'] . '|' . $foundLoc['lng'];

                if (!isset($added[$key])) {
                    $markers[] = [
                        'name' => $specificName,
                        'fullName' => $placeName,
                        'lat' => (float) $foundLoc['lat'],
                        'lng' => (float) $foundLoc['lng']
                    ];
                    $added[$key] = true;
                }
            }
        }

        return response(json_encode([
            'success' => true,
            'markers' => $markers,
            'count' => count($markers)
        ], JSON_THROW_ON_ERROR))
            ->withHeader('Content-Type', 'application/json');
    }
}
