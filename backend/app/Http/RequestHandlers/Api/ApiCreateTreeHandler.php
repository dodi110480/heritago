<?php

declare(strict_types=1);

namespace Fisharebest\Webtrees\Http\RequestHandlers\Api;

use Exception;
use Fisharebest\Webtrees\Auth;
use Fisharebest\Webtrees\I18N;
use Fisharebest\Webtrees\Registry;
use Fisharebest\Webtrees\Services\TreeService;
use Fisharebest\Webtrees\Tree;
use Fisharebest\Webtrees\Validator;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

use function e;

class ApiCreateTreeHandler implements RequestHandlerInterface
{
    public function __construct(
        private readonly TreeService $tree_service,
    ) {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        // Only admins can create trees in this simple implementation
        // This can be adjusted based on requirements
        if (!Auth::isAdmin()) {
            error_log('Permission denied for user ID: ' . (Auth::id() ?? 'null'));
            error_log('Auth::isAdmin() returned false for user ID: ' . (Auth::id() ?? 'null'));
            return Registry::responseFactory()->response([
                'success' => false,
                'message' => I18N::translate('You do not have permission to create a family tree.'),
            ], 403);
        }

        $name = Validator::parsedBody($request)->string('name');
        $title = Validator::parsedBody($request)->string('title');
        $firstName = Validator::parsedBody($request)->string('firstName');
        $lastName = Validator::parsedBody($request)->string('lastName');
        $gender = Validator::parsedBody($request)->string('gender', 'U');
        $birthDate = Validator::parsedBody($request)->string('birthDate');

        if ($this->tree_service->all()->get($name) instanceof Tree) {
            return Registry::responseFactory()->response([
                'success' => false,
                'message' => I18N::translate('The family tree “%s” already exists.', e($name)),
            ], 409);
        }

        try {
            $tree = $this->tree_service->create($name, $title, $firstName, $lastName, $gender, $birthDate);

            return Registry::responseFactory()->response([
                'success' => true,
                'tree' => [
                    'id' => $tree->id(),
                    'name' => $tree->name(),
                    'title' => $tree->title(),
                ],
            ]);
        } catch (Exception $ex) {
            return Registry::responseFactory()->response([
                'success' => false,
                'message' => $ex->getMessage(),
            ], 500);
        }
    }
}
