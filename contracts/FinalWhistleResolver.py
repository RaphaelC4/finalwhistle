# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *

import json
import typing


class FinalWhistleResolver(gl.Contract):
    owner: Address
    game_date: str
    home_team: str
    away_team: str
    condition: str
    resolution_url: str
    has_resolved: bool
    final_score: str
    verdict: str
    confidence: str

    def __init__(self, game_date: str, home_team: str, away_team: str, condition: str, resolution_url: str):
        self.owner = gl.message.sender_address
        self.game_date = game_date
        self.home_team = home_team
        self.away_team = away_team
        self.condition = condition
        self.resolution_url = resolution_url
        self.has_resolved = False
        self.final_score = "-"
        self.verdict = "pending"
        self.confidence = "0"

    @gl.public.view
    def get_market(self) -> typing.Any:
        return {
            "game_date": self.game_date,
            "home_team": self.home_team,
            "away_team": self.away_team,
            "condition": self.condition,
            "resolution_url": self.resolution_url,
            "has_resolved": self.has_resolved,
            "final_score": self.final_score,
            "verdict": self.verdict,
            "confidence": self.confidence,
        }

    @gl.public.write
    def update_condition(self, condition: str):
        if self.has_resolved:
            raise gl.vm.UserError("Market already resolved")
        if gl.message.sender_address != self.owner:
            raise gl.vm.UserError("Only the market creator can update the condition")
        self.condition = condition

    @gl.public.write
    def update_market(self, game_date: str, home_team: str, away_team: str, condition: str, resolution_url: str):
        if self.has_resolved:
            raise gl.vm.UserError("Market already resolved")
        if gl.message.sender_address != self.owner:
            raise gl.vm.UserError("Only the market creator can update the market")
        self.game_date = game_date
        self.home_team = home_team
        self.away_team = away_team
        self.condition = condition
        self.resolution_url = resolution_url

    @gl.public.write
    def resolve(self) -> typing.Any:
        if self.has_resolved:
            return self.get_market()

        def nondet() -> str:
            response = gl.nondet.web.get(self.resolution_url)
            web_data = response.body.decode("utf-8")
            task = f"""
            You are resolving a football prediction market.

            Match date: {self.game_date}
            Home team: {self.home_team}
            Away team: {self.away_team}
            User condition: {self.condition}

            Source page content:
            {web_data}

            Decide whether the user condition is true, false, or unresolved.
            If the match has not finished or the score cannot be extracted, use unresolved.
            Return only this JSON shape:
            {{
                "score": "home_goals:away_goals or -",
                "verdict": "true|false|unresolved",
                "confidence": "0-100",
                "reason": "short reason"
            }}
            """
            result = gl.nondet.exec_prompt(task).replace("```json", "").replace("```", "")
            parsed = json.loads(result)

            # Only the deterministic outcome fields go into the equivalence
            # check. "reason" is free-form LLM prose: validators can agree
            # on the score/verdict/confidence while phrasing the reason
            # differently, and a strict string comparison that includes it
            # would make consensus fail even when everyone agrees on the
            # actual result. Strip it before serialization.
            comparable = {
                "score": str(parsed.get("score", "-")),
                "verdict": str(parsed.get("verdict", "unresolved")),
                "confidence": str(parsed.get("confidence", "0")),
            }
            return json.dumps(comparable, sort_keys=True)

        result = json.loads(gl.eq_principle.strict_eq(nondet))

        self.final_score = result["score"]
        self.verdict = result["verdict"]
        self.confidence = result["confidence"]
        if result["verdict"] != "unresolved":
            self.has_resolved = True

        return result
