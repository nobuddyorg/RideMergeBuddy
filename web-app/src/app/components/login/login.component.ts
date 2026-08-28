import {Component} from '@angular/core';
import {ActivatedRoute, Params} from "@angular/router";

@Component({
  selector: 'login-component',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  STRAVA_AUTH_URL: string;

  message: string = 'This page lets you merge multiple Strava activities into one - handy when a single ride or trip gets split into several activities (e.g. after a long stop) and you\'d rather see it as one continuous activity. Your original activities are kept untouched.';
  displayMessage: string = this.message;

  constructor(private _route: ActivatedRoute) {
    let STRAVA_BASE_URL = 'http://www.strava.com/';
    // document.baseURI resolves the <base href> the build sets via
    // --base-href (e.g. /RideMergeBuddy/ on GitHub Pages, / in dev) against
    // the real origin - building this from window.location.hostname/port by
    // hand broke both on a portless https origin (empty port left a bare
    // "host:/activities") and on any base-href subpath (dropped it entirely).
    let STRAVA_REDIRECT_URL = document.baseURI + 'activities';
    let client_id = "66715";
    this.STRAVA_AUTH_URL = STRAVA_BASE_URL + 'oauth/authorize?client_id=' + client_id + '&approval_prompt=force&scope=activity:read_all,activity:write&response_type=code&redirect_uri=' + STRAVA_REDIRECT_URL;

    _route.queryParams.subscribe((params: Params) => {
      if (params.error) {
        this.displayMessage = 'ERROR: ' + params.error;
      } else {
        this.displayMessage = this.message;
      }
    })
  }
}
