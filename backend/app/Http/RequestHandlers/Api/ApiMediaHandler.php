<?php

declare(strict_types=1);

namespace Fisharebest\Webtrees\Http\RequestHandlers\Api;

use Fisharebest\Webtrees\DB;
use Fisharebest\Webtrees\Registry;
use Fisharebest\Webtrees\Services\TreeService;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

use function json_encode;
use function response;

use const JSON_THROW_ON_ERROR;

class ApiMediaHandler implements RequestHandlerInterface
{
    public function __construct(
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

        // Fetch all media objects for this tree
        $media_rows = DB::table('media')
            ->where('m_file', '=', $tree->id())
            ->pluck('m_id');

        $media_items = [];

        foreach ($media_rows as $xref) {
            $media_object = Registry::mediaFactory()->make($xref, $tree);

            if ($media_object) {
                // Get the first image file
                $file = $media_object->firstImageFile();

                if ($file) {
                    $media_items[] = [
                        'id' => $media_object->xref(),
                        'title' => $media_object->fullName(), // fullName() returns title
                        'url' => $file->imageUrl(800, 600, 'contain'),
                        'thumbnail' => $file->imageUrl(300, 300, 'crop'),
                        'type' => $file->mimeType(),
                    ];
                }
            }
        }

        return response(json_encode([
            'success' => true,
            'media' => $media_items,
        ], JSON_THROW_ON_ERROR))
            ->withHeader('Content-Type', 'application/json');
    }
}
