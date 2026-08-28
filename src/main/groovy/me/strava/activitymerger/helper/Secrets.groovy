package me.strava.activitymerger.helper

import groovy.json.JsonSlurper
import org.springframework.stereotype.Component

@Component
class Secrets {
    static def secrets

    def getSecret(def key) {
        if (!secrets) {
            secrets = new JsonSlurper().parseText(getClass().getResourceAsStream('/.secrets').text)
        }

        secrets."$key"
    }
}
