<?php

declare(strict_types=1);

namespace Fisharebest\Webtrees\Http\RequestHandlers\Api;

use Fisharebest\Webtrees\DB;
use Fisharebest\Webtrees\Registry;
use Fisharebest\Webtrees\Services\TreeService;
use Fisharebest\Webtrees\Tree;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

use function json_encode;
use function response;

use const JSON_THROW_ON_ERROR;

class ApiPlaceSearchHandler implements RequestHandlerInterface
{
    public function __construct(
        private readonly TreeService $tree_service,
    ) {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $tree_attr = $request->getAttribute('tree');
        $tree = ($tree_attr instanceof Tree) ? $tree_attr : $this->tree_service->all()->get($tree_attr);

        if (!$tree) {
            return Registry::responseFactory()->response(['success' => false, 'message' => 'Tree not found'], 404);
        }

        $query = $request->getQueryParams()['q'] ?? '';

        if (strlen($query) < 1) {
            return Registry::responseFactory()->response([
                'success' => true,
                'results' => [],
            ]);
        }

        // Search in places table
        // p_place is the base part (e.g. "Westminster" in "Westminster, London, England")
        // But we want the full place name if possible, or at least common ones.
        // The places table usually stores parts. To get full names, we might need to join or look at another table.
        // webtrees also has a mechanism to rebuild full names.

        // Actually, wt_places table has p_place and p_parent_id.
        // Let's try to find unique full names.
        // For simplicity and performance, we can search for places that START with the query.

        $results = DB::table('places')
            ->where('p_file', '=', $tree->id())
            ->where('p_place', 'LIKE', $query . '%')
            ->limit(20)
            ->get()
            ->map(function ($row) use ($tree) {
                // Return the full name using the Place domain object
                $place = \Fisharebest\Webtrees\Place::find((int) $row->p_id, $tree);
                return [
                    'name' => $place->gedcomName(),
                ];
            })
            ->unique('name')
            ->values()
            ->all();

        return response(json_encode([
            'success' => true,
            'results' => $results,
        ], JSON_THROW_ON_ERROR))
            ->withHeader('Content-Type', 'application/json');
    }
}
