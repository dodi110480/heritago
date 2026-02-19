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

class ApiStatisticsHandler implements RequestHandlerInterface
{
    public function __construct(
        private readonly TreeService $tree_service,
    ) {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $tree_name = $request->getAttribute('tree');

        if ($tree_name instanceof \Fisharebest\Webtrees\Tree) {
            $tree = $tree_name;
        } else {
            $tree = $this->tree_service->all()->get($tree_name);
        }

        if (!$tree) {
            return Registry::responseFactory()->response([
                'success' => false,
                'message' => 'Tree not found',
            ], 404);
        }

        $tree_id = $tree->id();

        // Counts
        $individuals_count = DB::table('individuals')->where('i_file', '=', $tree_id)->count();
        $families_count = DB::table('families')->where('f_file', '=', $tree_id)->count();
        $places_count = DB::table('places')->where('p_file', '=', $tree_id)->count();
        $media_count = DB::table('media')->where('m_file', '=', $tree_id)->count();

        // Gender Distribution
        $males = DB::table('individuals')
            ->where('i_file', '=', $tree_id)
            ->where('i_sex', '=', 'M')
            ->count();
        $females = DB::table('individuals')
            ->where('i_file', '=', $tree_id)
            ->where('i_sex', '=', 'F')
            ->count();
        $others = DB::table('individuals')
            ->where('i_file', '=', $tree_id)
            ->where('i_sex', '=', 'X')
            ->count();
        $unknown_sex = $individuals_count - $males - $females - $others;

        // Oldest and Youngest (based on indexed dates)
        $oldest_birth = DB::table('dates')
            ->where('d_file', '=', $tree_id)
            ->where('d_fact', '=', 'BIRT')
            ->orderBy('d_julianday1', 'asc')
            ->first();

        $youngest_birth = DB::table('dates')
            ->where('d_file', '=', $tree_id)
            ->where('d_fact', '=', 'BIRT')
            ->orderBy('d_julianday1', 'desc')
            ->first();

        $oldest_name = '';
        if ($oldest_birth) {
            $oldest_name = DB::table('name')
                ->where('n_file', '=', $tree_id)
                ->where('n_id', '=', $oldest_birth->d_gid)
                ->orderBy('n_num', 'asc')
                ->value('n_full');
        }

        $youngest_name = '';
        if ($youngest_birth) {
            $youngest_name = DB::table('name')
                ->where('n_file', '=', $tree_id)
                ->where('n_id', '=', $youngest_birth->d_gid)
                ->orderBy('n_num', 'asc')
                ->value('n_full');
        }

        return response(json_encode([
            'success' => true,
            'counts' => [
                'individuals' => $individuals_count,
                'families' => $families_count,
                'places' => $places_count,
                'media' => $media_count,
            ],
            'gender' => [
                'male' => $males,
                'female' => $females,
                'other' => $others,
                'unknown' => $unknown_sex,
            ],
            'extremes' => [
                'oldest' => [
                    'name' => $oldest_name,
                    'year' => $oldest_birth ? $oldest_birth->d_year : null,
                ],
                'youngest' => [
                    'name' => $youngest_name,
                    'year' => $youngest_birth ? $youngest_birth->d_year : null,
                ],
            ],
        ], JSON_THROW_ON_ERROR))
            ->withHeader('Content-Type', 'application/json');
    }
}
