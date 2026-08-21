// @ts-check

/**
 * Single source of truth for every page's URL. Nothing outside this file
 * should ever write a ".html" path by hand — that's what led to
 * navigation URLs being hardcoded (and duplicating ROLE_HOME) across app.js.
 *
 * Every route is relative to wherever the current script happens to be
 * running from, since this is a plain static site (no router, no
 * server-side rewriting): the login screen at the site root (index.html),
 * or one of the pages under pages/. IS_INSIDE_PAGES detects which one, so
 * every route below works unchanged from either location.
 */

const IS_INSIDE_PAGES = window.location.pathname.includes("/pages/");

/** Prefix to reach a page under pages/ from wherever we currently are. */
const PAGES_PREFIX = IS_INSIDE_PAGES ? "./" : "pages/";

/** Prefix to reach the site root from wherever we currently are. */
const ROOT_PREFIX = IS_INSIDE_PAGES ? "../" : "./";

const ROUTES = {
  login: () => `${ROOT_PREFIX}index.html`,

  /** @param {UserRole} role @returns {string} */
  home: (role) => `${PAGES_PREFIX}index-${role}.html`,

  addRequest: () => `${PAGES_PREFIX}add-request.html`,
  clientList: () => `${PAGES_PREFIX}client-list.html`,

  /** @param {string} id @returns {string} */
  userDetail: (id) =>
    `${PAGES_PREFIX}detail-users.html?id=${encodeURIComponent(id)}`,

  /** @param {string} id @returns {string} */
  requestDetail: (id) =>
    `${PAGES_PREFIX}request-detail.html?id=${encodeURIComponent(id)}`,
};
