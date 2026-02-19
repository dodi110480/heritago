<?php

declare(strict_types=1);

namespace Fisharebest\Webtrees\Http\RequestHandlers\Api;

use Fisharebest\Webtrees\Registry;
use Fisharebest\Webtrees\Services\SearchService;
use Fisharebest\Webtrees\Services\TreeService;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

use function json_encode;
use function response;

use const JSON_THROW_ON_ERROR;

class ApiSearchHandler implements RequestHandlerInterface
{
    public function __construct(
        private readonly SearchService $search_service,
        private readonly TreeService $tree_service,
    ) {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $tree_name = $request->getAttribute('tree');
        $tree = $this->tree_service->all()->get($tree_name);

        if (!$tree) {
            return Registry::responseFactory()->response([
                'success' => false,
                'message' => 'Tree not found',
            ], 404);
        }

        $query = $request->getQueryParams()['q'] ?? '';

        if (empty($query)) {
            return Registry::responseFactory()->response([
                'success' => true,
                'results' => [],
            ]);
        }

        // Simple search for individuals
        $results = $this->search_service->searchIndividuals($request->getAttribute('trees', [$tree]), [$query])
            ->map(function ($indi) {
                return [
                    'id' => $indi->xref(),
                    'name' => $indi->fullName(),
                    'lifespan' => $indi->lifespan(),
                    'gender' => $indi->sex(),
                ];
            })
            ->values()
            ->all();

        return response(json_encode([
            'success' => true,
            'results' => $results,
        ], JSON_THROW_ON_ERROR))
            ->withHeader('Content-Type', 'application/json');
    }
}
