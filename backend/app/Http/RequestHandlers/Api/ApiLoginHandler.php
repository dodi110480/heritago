<?php

declare(strict_types=1);

namespace Fisharebest\Webtrees\Http\RequestHandlers\Api;

use Exception;
use Fisharebest\Webtrees\Auth;
use Fisharebest\Webtrees\Contracts\UserInterface;
use Fisharebest\Webtrees\I18N;
use Fisharebest\Webtrees\Log;
use Fisharebest\Webtrees\Registry;
use Fisharebest\Webtrees\Services\UserService;
use Fisharebest\Webtrees\Session;
use Fisharebest\Webtrees\Validator;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

use function time;

class ApiLoginHandler implements RequestHandlerInterface
{
    public function __construct(
        private readonly UserService $user_service,
    ) {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $username = Validator::parsedBody($request)->string('username');
        $password = Validator::parsedBody($request)->string('password');

        try {
            $user = $this->doLogin($username, $password);

            return Registry::responseFactory()->response([
                'success' => true,
                'user' => [
                    'id' => $user->id(),
                    'username' => $user->userName(),
                    'realName' => $user->realName(),
                    'isAdmin' => Auth::isAdmin($user),
                ],
            ]);
        } catch (Exception $ex) {
            return Registry::responseFactory()->response([
                'success' => false,
                'message' => $ex->getMessage(),
            ], 401);
        }
    }

    /**
     * @param string $username
     * @param string $password
     *
     * @return UserInterface
     * @throws Exception
     */
    private function doLogin(string $username, #[\SensitiveParameter] string $password): UserInterface
    {
        $user = $this->user_service->findByIdentifier($username);

        if ($user === null || !$user->checkPassword($password)) {
            Log::addAuthenticationLog('API Login failed (incorrect credentials): ' . $username);
            throw new Exception(I18N::translate('The username or password is incorrect.'));
        }

        if ($user->getPreference(UserInterface::PREF_IS_EMAIL_VERIFIED) !== '1') {
            Log::addAuthenticationLog('API Login failed (not verified): ' . $username);
            throw new Exception(I18N::translate('This account has not been verified.'));
        }

        if ($user->getPreference(UserInterface::PREF_IS_ACCOUNT_APPROVED) !== '1') {
            Log::addAuthenticationLog('API Login failed (not approved): ' . $username);
            throw new Exception(I18N::translate('This account has not been approved.'));
        }

        Auth::login($user);
        Log::addAuthenticationLog('API Login: ' . $user->userName());
        $user->setPreference(UserInterface::PREF_TIMESTAMP_ACTIVE, (string) time());

        Session::put('language', $user->getPreference(UserInterface::PREF_LANGUAGE, 'en-US'));
        Session::put('theme', $user->getPreference(UserInterface::PREF_THEME));
        I18N::init($user->getPreference(UserInterface::PREF_LANGUAGE, 'en-US'));

        return $user;
    }
}
