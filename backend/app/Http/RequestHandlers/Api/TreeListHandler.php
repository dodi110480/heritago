<?php

declare(strict_types=1);

namespace Fisharebest\Webtrees\Http\RequestHandlers\Api;

use Fisharebest\Webtrees\Registry;
use Fisharebest\Webtrees\Services\TreeService;
use Fisharebest\Webtrees\Tree;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

class TreeListHandler implements RequestHandlerInterface
{
    public function __construct(
        private readonly TreeService $tree_service,
    ) {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $trees = $this->tree_service->all()->map(function (Tree $tree) {
            return [
                'id' => (string) $tree->id(),
                'name' => $tree->name(),
                'title' => $tree->title(),
            ];
        })->values()->all();

        return response(json_encode([
            'success' => true,
            'trees' => $trees,
        ], JSON_THROW_ON_ERROR))
            ->withHeader('Content-Type', 'application/json');
    }
}
