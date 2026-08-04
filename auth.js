/**
 * ESODI - Module d'Authentification
 * Base locale des utilisateurs (localStorage)
 *
 * Comptes test intégrés :
 *   - Identifiant : admin     | Mot de passe : admin123  | Rôle : admin
 *   - Identifiant : KOLA      | Mot de passe : kola123   | Rôle : enseignant
 *   - Identifiant : eleve     | Mot de passe : eleve123  | Rôle : eleve
 */
(function (window) {
    'use strict';

    const DB_KEY = 'esodi_users_db';
    const DB_VERSION_KEY = 'esodi_users_db_version';
    const SESSION_KEY = 'esodi_session';
    // Incrémenter ce numéro à chaque modification des comptes par défaut
    const DB_VERSION = 2;

    /**
     * Initialise ou met à jour la base locale avec les comptes par défaut.
     * La base est régénérée si elle n'existe pas ou si la version a changé.
     */
    function initDatabase() {
        const storedVersion = parseInt(localStorage.getItem(DB_VERSION_KEY) || '0', 10);
        const existingDb = localStorage.getItem(DB_KEY);

        if (existingDb && storedVersion === DB_VERSION) {
            return; // Base à jour
        }

        const defaultUsers = [
            {
                id: 1,
                username: 'admin',
                password: 'admin123',
                role: 'admin',
                fullName: 'Administrateur ESODI',
                email: 'admin@esodi.tg',
                createdAt: new Date().toISOString()
            },
            {
                id: 2,
                username: 'KOLA',
                password: 'kola123',
                role: 'enseignant',
                fullName: 'KOLA Maniwah Essohouna',
                email: 'kola@esodi.tg',
                createdAt: new Date().toISOString()
            },
            {
                id: 3,
                username: 'eleve',
                password: 'eleve123',
                role: 'eleve',
                fullName: 'Élève Test ESODI',
                email: 'eleve@esodi.tg',
                classe: 'Terminale D',
                createdAt: new Date().toISOString()
            }
        ];

        // Conserver les utilisateurs ajoutés manuellementalement si la base existait
        let customUsers = [];
        if (existingDb) {
            try {
                const oldUsers = JSON.parse(existingDb);
                // On conserve les utilisateurs qui ne sont pas dans les comptes par défaut
                customUsers = oldUsers.filter(oldU =>
                    !defaultUsers.some(defU =>
                        defU.username.toLowerCase() === oldU.username.toLowerCase()
                    )
                );
            } catch (e) {
                customUsers = [];
            }
        }

        const allUsers = [...defaultUsers, ...customUsers];
        localStorage.setItem(DB_KEY, JSON.stringify(allUsers));
        localStorage.setItem(DB_VERSION_KEY, String(DB_VERSION));
    }

    /**
     * Récupère tous les utilisateurs de la base locale.
     */
    function getUsers() {
        initDatabase();
        try {
            return JSON.parse(localStorage.getItem(DB_KEY)) || [];
        } catch (e) {
            console.error('Erreur de lecture de la base locale :', e);
            return [];
        }
    }

    /**
     * Tente de connecter un utilisateur.
     * @param {string} username - Identifiant saisi
     * @param {string} password - Mot de passe saisi
     * @returns {object} - { success, message, user? }
     */
    function login(username, password) {
        if (!username || !password) {
            return { success: false, message: 'Veuillez renseigner tous les champs.' };
        }

        const users = getUsers();
        const user = users.find(
            u => u.username.toLowerCase() === username.trim().toLowerCase()
        );

        if (!user) {
            return { success: false, message: 'Identifiant introuvable dans la base locale.' };
        }

        if (user.password !== password) {
            return { success: false, message: 'Mot de passe incorrect.' };
        }

        // On ne stocke jamais le mot de passe en session
        const sessionUser = {
            id: user.id,
            username: user.username,
            role: user.role,
            fullName: user.fullName,
            email: user.email,
            classe: user.classe || null,
            loggedAt: new Date().toISOString()
        };

        sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
        localStorage.setItem(SESSION_KEY + '_persistent', JSON.stringify(sessionUser));

        return { success: true, message: 'Connexion réussie', user: sessionUser };
    }

    /**
     * Déconnecte l'utilisateur courant.
     */
    function logout() {
        sessionStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(SESSION_KEY + '_persistent');
    }

    /**
     * Récupère l'utilisateur courant (ou null).
     */
    function getCurrentUser() {
        const session = sessionStorage.getItem(SESSION_KEY) ||
                        localStorage.getItem(SESSION_KEY + '_persistent');
        if (!session) return null;
        try {
            return JSON.parse(session);
        } catch (e) {
            return null;
        }
    }

    /**
     * Vérifie si l'utilisateur est connecté.
     */
    function isAuthenticated() {
        return getCurrentUser() !== null;
    }

    /**
     * Vérifie si l'utilisateur courant a l'un des rôles autorisés.
     * @param {string[]} allowedRoles - Rôles autorisés
     * @returns {boolean}
     */
    function hasRole(allowedRoles) {
        const user = getCurrentUser();
        if (!user) return false;
        if (!Array.isArray(allowedRoles)) allowedRoles = [allowedRoles];
        return allowedRoles.includes(user.role);
    }

    /**
     * Retourne l'URL de la page d'accueil du rôle de l'utilisateur courant.
     */
    function getHomeUrlForCurrentRole() {
        const user = getCurrentUser();
        if (!user) return 'login.html';
        switch (user.role) {
            case 'admin':
            case 'enseignant':
                return 'esodi-enseignants.html';
            case 'eleve':
                return 'esodi-eleves.html';
            default:
                return 'esodi.html';
        }
    }

    /**
     * Protège une page : redirige vers la page de connexion
     * si l'utilisateur n'est pas authentifié ou n'a pas le rôle requis.
     * @param {string} loginUrl - URL de la page de connexion
     * @param {string[]} [allowedRoles] - Rôles autorisés à voir cette page
     */
    function requireAuth(loginUrl, allowedRoles) {
        loginUrl = loginUrl || 'login.html';

        // 1. Vérifier que l'utilisateur est connecté
        if (!isAuthenticated()) {
            const currentPath = window.location.pathname.split('/').pop() || 'index.html';
            window.location.href = loginUrl + '?redirect=' + encodeURIComponent(currentPath);
            return false;
        }

        // 2. Vérifier le rôle si des rôles sont spécifiés
        if (allowedRoles && !hasRole(allowedRoles)) {
            // L'utilisateur est connecté mais n'a pas le bon rôle
            // On le redirige vers sa propre page d'accueil
            const user = getCurrentUser();
            alert('Accès refusé : votre compte (' + (user ? user.role : '') +
                  ') n\'est pas autorisé à accéder à cette page. Redirection vers votre espace.');
            window.location.href = getHomeUrlForCurrentRole();
            return false;
        }

        return true;
    }

    /**
     * Ajoute un nouvel utilisateur à la base locale.
     */
    function addUser(userData) {
        const users = getUsers();
        if (users.some(u => u.username.toLowerCase() === userData.username.toLowerCase())) {
            return { success: false, message: 'Cet identifiant existe déjà.' };
        }
        const newUser = {
            id: users.length ? Math.max(...users.map(u => u.id)) + 1 : 1,
            username: userData.username,
            password: userData.password,
            role: userData.role || 'enseignant',
            fullName: userData.fullName || userData.username,
            email: userData.email || '',
            classe: userData.classe || null,
            createdAt: new Date().toISOString()
        };
        users.push(newUser);
        localStorage.setItem(DB_KEY, JSON.stringify(users));
        return { success: true, message: 'Utilisateur ajouté', user: newUser };
    }

    // Expose l'API publique
    window.ESODIAuth = {
        initDatabase,
        getUsers,
        login,
        logout,
        getCurrentUser,
        isAuthenticated,
        hasRole,
        getHomeUrlForCurrentRole,
        requireAuth,
        addUser,
        DB_VERSION
    };

    // Initialisation automatique
    initDatabase();
})(window);
