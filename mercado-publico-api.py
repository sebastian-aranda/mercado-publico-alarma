import asyncio
import logging
import os
import requests


logger = logging.getLogger("MercadoPublicoApiPuller")
logger.setLevel(logging.INFO)
handler = logging.StreamHandler()
formatter = logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
handler.setFormatter(formatter)
logger.addHandler(handler)


class MercadoPublicoApi:
    def __init__(
        self,
        base_url: str = "https://api.mercadopublico.cl/servicios/v1/publico",
    ):
        self.base_url = base_url

    def get_tenders(self, params: dict | None = None):
        """Fetches tenders from the Mercado Publico
        API (https://api.mercadopublico.cl).

        Parameters:
        -----------
        params : `dict`, optional
            A dictionary of query parameters to filter the tenders.

        Returns:
        --------
        tenders : `list`
            A list of tenders matching the query parameters.
        """

        url = f"{self.base_url}/licitaciones.json"
        response = requests.get(url, params=params)

        if response.status_code == 200:
            return response.json()
        response.raise_for_status()


class MercadoPublicoDataPuller:
    def __init__(
        self,
        api: MercadoPublicoApi | None = None,
        period: int = 3600,
    ):
        if api is None:
            api = MercadoPublicoApi()
        self.api = api
        self.period = period
        self.stop_event = asyncio.Event()

    async def data_pull_loop(
        self,
        params: dict | None = None,
        max_retries: int = 5,
    ):
        """Asynchronously fetches tenders in a loop
        with graceful shutdown and retry logic.

        Parameters:
        -----------
        params : `dict`, optional
            A dictionary of query parameters to filter the tenders.
        max_retries : `int`, optional
            Maximum number of retries for transient errors before stopping.

        Yields:
        -------
        tenders : `list`
            A list of tenders fetched from the API.
        """
        retries = 0
        while not self.stop_event.is_set():  # Check if the stop event is set
            try:
                tenders = self.api.get_tenders(params)['Listado']
                logger.debug(f"Fetched {len(tenders)} tenders.")
                yield tenders
                retries = 0
            except Exception as e:
                retries += 1
                logging.warning(
                    f"Error fetching tenders: {e}. "
                    f"Retrying {retries}/{max_retries}..."
                )
                if retries >= max_retries:
                    logger.warning(
                        "Max retries reached. Stopping data pull loop."
                    )
                    break
            await asyncio.sleep(self.period)

    def stop(self):
        """Signal the loop to stop."""
        self.stop_event.set()


class TelegramNotifier:
    def __init__(
        self,
        token: str,
        chat_id: str,
    ):
        self.token = token
        self.chat_id = chat_id

    def send_message(self, message: str):
        """Sends a message to a Telegram chat.

        Parameters:
        -----------
        message : `str`
            The message to send.
        """
        url = f"https://api.telegram.org/bot{self.token}/sendMessage"
        payload = {
            'chat_id': self.chat_id,
            'text': message
        }
        response = requests.post(url, json=payload)
        if response.status_code != 200:
            raise Exception(f"Failed to send message: {response.text}")


class DiscordNotifier:
    def __init__(self, webhook_url: str):
        self.webhook_url = webhook_url

    def send_message(self, message: str):
        """Sends a message to a Discord channel.

        Parameters:
        -----------
        message : `str`
            The message to send.
        """
        payload = {
            'content': message
        }
        response = requests.post(self.webhook_url, json=payload)
        if response.status_code != 204:
            raise Exception(f"Failed to send message: {response.text}")


def main():
    api = MercadoPublicoApi()
    puller = MercadoPublicoDataPuller(api=api)
    tenders_dict = dict()

    mp_token = os.getenv('MERCADO_PUBLICO_API_TOKEN')
    if not mp_token:
        raise ValueError(
            "MERCADO_PUBLICO_API_TOKEN environment variable is not set."
        )

    # telegram_token = os.getenv('TELEGRAM_BOT_TOKEN')
    # telegram_chat_id = os.getenv('TELEGRAM_CHAT_ID')
    # if not telegram_token or not telegram_chat_id:
    #     raise ValueError(
    #         "TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID"
    #         " environment variables are not set."
    #     )
    # notifier = TelegramNotifier(telegram_token, telegram_chat_id)

    discord_webhook_url = os.getenv('DISCORD_WEBHOOK_URL')
    if not discord_webhook_url:
        raise ValueError(
            "DISCORD_WEBHOOK_URL environment variable is not set."
        )
    notifier = DiscordNotifier(
        webhook_url=discord_webhook_url
    )

    async def run():
        pull_count = 0
        async for tenders in puller.data_pull_loop({
            'ticket': mp_token,
            'estado': 'activas',
        }):
            pull_count += 1
            keywords = [
                'curso',
                'taller',
                'capacitación',
                'capacitacion'
            ]
            filtered_tenders = [
                tender for tender in tenders
                if any(
                    keyword.lower() in tender['Nombre'].lower()
                    for keyword in keywords
                )
            ]
            if filtered_tenders:
                logger.info(
                    f"Found {len(filtered_tenders)}/{len(tenders)}"
                    " tenders matching keywords."
                )
                for tender in filtered_tenders:
                    tender_id = tender['CodigoExterno']
                    if tender_id not in tenders_dict:
                        tenders_dict[tender_id] = tender
                        message = (
                            f"Nueva licitación encontrada: {tender['Nombre']} "
                            f"(ID: {tender_id})"
                        )
                        logger.info(message)
                        if pull_count > 1:
                            notifier.send_message(message)
            else:
                logger.info("No new tenders found matching keywords.")

    loop = asyncio.get_event_loop()
    try:
        loop.run_until_complete(run())
    except KeyboardInterrupt:
        logger.info("Stopping data puller...")
        puller.stop()
    finally:
        loop.close()


if __name__ == "__main__":
    main()
