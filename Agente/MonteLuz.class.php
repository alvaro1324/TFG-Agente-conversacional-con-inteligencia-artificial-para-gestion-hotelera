<?php

class MonteLuz extends CVMain
{
	public static $config;
	public static $session;
	private $conn_ms;
	private $conn_ivrevents;

	private $geminiModelExtraction = 'gemini-2.5-flash-lite';
	private $geminiModelReply = 'gemini-2.5-flash-lite';
	private $geminiApiKey = '';


		
	public function __construct() {	
		parent::__construct();
		$this->setAllowedParams();
		$this->setConfig();
		$this->setLog(MonteLuzConf::PROJECT_NAME, $this->config['logsPath'], $this->config['logsName']);
	}

	
	public function	agentConversation() {
		
		header("HTTP/1.1 200 OK");
		header("Content-Type: application/json; charset=utf-8");
		
		// Get raw body request
		$rawBody = file_get_contents("php://input");
		$this->log("[agentConversation] RAW php://input: " . $rawBody, PEAR_LOG_INFO);
		
		// Intentamos decodificarlo
		$data = json_decode($rawBody, true);

		if (json_last_error() !== JSON_ERROR_NONE) {
			$this->log("[agentConversation] Error decodificando JSON: " . json_last_error_msg(), PEAR_LOG_ERR);
			$mock = Array();
			$mock["error"] = "Error al parsear JSON: " . json_last_error_msg();
			$jsonData = json_encode($mock);
			$this->log("[agentConversation] Respuesta de error enviada: " . $jsonData, PEAR_LOG_ERR);
			echo $jsonData;
			exit;
		}
		
		$this->log("[agentConversation] JSON decodificado: " . print_r($data, true), PEAR_LOG_INFO);
		$externalSessionId = isset($data['session_id']) ? trim((string)$data['session_id']) : '';
		$currentConfid = $this->normalizeConfid($externalSessionId);

		if ($currentConfid !== '') {
			$this->session->set_data('current_confid', $currentConfid);
		}
		
		if (!empty($externalSessionId)) {
			$this->restoreFlowContextByExternalSession($externalSessionId);
		}
		
		// Obtener input del usuario
		$userInput = isset($data['input_text']) ? $data['input_text'] : '';
		$this->log("[agentConversation] Input del usuario: " . $userInput, PEAR_LOG_INFO);
		
		// Llamar a Gemini con el contexto actual
		$respuestaIA = $this->callGeminiAI($userInput);
		$accion = $this->session->get_data('agent_action');
		if (empty($accion)) {
			$accion = '';
		}
		
		$mock = Array();
		$mock["agent_response"] = $respuestaIA;
		$mock["action"] = $accion;

		if (!empty($externalSessionId)) {
			$this->persistFlowContextByExternalSession($externalSessionId);
		}
		
		$jsonData = json_encode($mock);
		$this->log("[agentConversation] Respuesta enviada: " . $jsonData, PEAR_LOG_INFO);
		
		echo $jsonData;
		exit;
	}

	public function getAiAgentInfoByConfid() {

		header("HTTP/1.1 200 OK");
		header("Content-Type: application/json; charset=utf-8");

		$confid = filter_input(INPUT_POST, 'confid', FILTER_SANITIZE_STRING);
		if (empty($confid)) {
			$confid = filter_input(INPUT_POST, 'confId', FILTER_SANITIZE_STRING);
		}

		if (empty($confid)) {
			$rawBody = file_get_contents("php://input");
			$data = json_decode($rawBody, true);
			if (json_last_error() === JSON_ERROR_NONE && is_array($data)) {
				if (!empty($data['confid'])) {
					$confid = trim((string) $data['confid']);
				} elseif (!empty($data['confId'])) {
					$confid = trim((string) $data['confId']);
				}
			}
		}

		$confid = trim((string) $confid);

		if ($confid === '') {
			$this->log("[getAiAgentInfoByConfid] Peticion sin confid.", PEAR_LOG_ERR);
			http_response_code(400);
			echo json_encode(array(
				"success" => false,
				"error" => "Parametro confid obligatorio"
			), JSON_UNESCAPED_UNICODE);
			exit;
		}

		$this->log("[test] Empezamos en el select [IVR_EVENTS].", PEAR_LOG_INFO);
		$response = '';

		try {
			$sql = "SELECT * FROM [IVR_EVENTS].[dbo].[AI_AGENT_INFO] WITH (NOLOCK) WHERE [confid] = ?";
			$stmt = $this->conn_ivrevents->execute($sql, array($confid));
			$resultados = $stmt->fetchAll(PDO::FETCH_ASSOC);

			if (!is_array($resultados)) {
				$resultados = array();
			}

			$response = json_encode(array(
				"success" => true,
				"confid" => $confid,
				"total" => count($resultados),
				"data" => $resultados
			), JSON_UNESCAPED_UNICODE);

		} catch (Exception $e) {
			$this->log("[getAiAgentInfoByConfid] Error al ejecutar la query: " . $e->getMessage(), PEAR_LOG_ERR);
			http_response_code(500);
			$response = json_encode(array(
				"success" => false,
				"error" => "Error al ejecutar la query",
				"message" => $e->getMessage()
			), JSON_UNESCAPED_UNICODE);
		} finally {
			$this->log("[test] Terminamos en el select [IVR_EVENTS].", PEAR_LOG_INFO);
		}

		echo $response;
		exit;
	}

	public function getJsonInfoByConfid() {

		header("HTTP/1.1 200 OK");
		header("Content-Type: application/json; charset=utf-8");

		$confid = filter_input(INPUT_POST, 'confid', FILTER_SANITIZE_STRING);
		if (empty($confid)) {
			$confid = filter_input(INPUT_POST, 'confId', FILTER_SANITIZE_STRING);
		}

		if (empty($confid)) {
			$rawBody = file_get_contents("php://input");
			$data = json_decode($rawBody, true);
			if (json_last_error() === JSON_ERROR_NONE && is_array($data)) {
				if (!empty($data['confid'])) {
					$confid = trim((string) $data['confid']);
				} elseif (!empty($data['confId'])) {
					$confid = trim((string) $data['confId']);
				}
			}
		}

		$confid = trim((string) $confid);

		if ($confid === '') {
			$this->log("[getJsonInfoByConfid] Peticion sin confid.", PEAR_LOG_ERR);
			http_response_code(400);
			echo json_encode(array(
				"success" => false,
				"error" => "Parametro confid obligatorio"
			), JSON_UNESCAPED_UNICODE);
			exit;
		}

		$this->log("[getJsonInfoByConfid] Empezamos select en [cvr_user_info_call].", PEAR_LOG_INFO);

		try {
			$record = Doctrine_Query::create()
				->from('CvrUserInfoCall c')
				->where('c.confid = ?', $confid)
				->fetchOne(array(), Doctrine_Core::HYDRATE_ARRAY);

			if (empty($record) || !isset($record['json_info'])) {
				http_response_code(404);
				echo json_encode(array(
					"success" => false,
					"error" => "No existe informacion para ese confid"
				), JSON_UNESCAPED_UNICODE);
				exit;
			}

			echo $record['json_info'];
			exit;

		} catch (Exception $e) {
			$this->log("[getJsonInfoByConfid] Error al ejecutar la query: " . $e->getMessage(), PEAR_LOG_ERR);
			http_response_code(500);
			echo json_encode(array(
				"success" => false,
				"error" => "Error al ejecutar la query",
				"message" => $e->getMessage()
			), JSON_UNESCAPED_UNICODE);
			exit;
		}
	}


	private function callGeminiAI($userInput) {
		$input = trim((string) $userInput);
		$this->session->set_data('agent_action', '');
		$state = $this->session->get_data('ai_flow_state');
		$ctx = $this->session->get_data('ai_flow_ctx');

		if (empty($state)) {
			$state = 'WELCOME';
		}
		if (!is_array($ctx)) {
			$ctx = array();
		}

		$ctxBeforeMerge = $ctx;
		$aiExtraction = $this->extractFlowDataWithGemini($input, $state, $ctx);
		$aiExtraction = $this->preserveExtractionContextOnEnd($aiExtraction, $ctx);
		if ($this->isEndIntent($input) || $this->isTransferToPersonIntent($input)) {
			$aiExtraction['end'] = 'yes';
		}
		$aiExtraction = $this->mergeAiExtractionKeepingPrevious($aiExtraction, $ctxBeforeMerge);
		$this->session->set_data('ai_last_extraction', $aiExtraction);
		$this->log("[AI_FLOW] Extracción IA parseada: " . json_encode($aiExtraction), PEAR_LOG_INFO);
		$this->saveAiExtractionByConfid($aiExtraction);

		if ($this->isEndIntent($input)) {
			$this->session->set_data('ai_flow_state', 'WELCOME');
			$this->session->set_data('ai_flow_ctx', array());
			$this->log("[AI_FLOW] Accion interpretada por el agente: colgar", PEAR_LOG_INFO);
			$this->session->set_data('agent_action', 'colgar');
			return $this->generateAgentReplyWithGroq('WELCOME', array(), 'Despedida breve y amable de cierre de llamada.');
		}

		if ($this->isTransferToPersonIntent($input)) {
			$this->session->set_data('ai_flow_state', 'WELCOME');
			$this->session->set_data('ai_flow_ctx', array());
			$this->log("[AI_FLOW] Accion interpretada por el agente: transferencia", PEAR_LOG_INFO);
			$this->session->set_data('agent_action', 'transferencia');
			return $this->generateAgentReplyWithGroq('WELCOME', array(), 'Indica de forma breve y amable que vas a pasar la llamada con una persona del hotel.');
		}

		$ctx = $this->mergeFlowContextFromAi($ctx, $aiExtraction);
		$fallback = $this->applyDeterministicCaptureFallback($state, $input, $ctx, $aiExtraction);
		$ctx = $fallback['ctx'];
		$aiExtraction = $fallback['aiExtraction'];
		$ctx = $this->recoverDatesAfterPeopleCorrection($state, $ctx, $aiExtraction);
		$ctx = $this->syncStayDatesFromContext($ctx);

		if ($this->isCapabilitiesQuestion($input)) {
			$this->session->set_data('ai_flow_state', $state);
			$this->session->set_data('ai_flow_ctx', $ctx);
			return 'Puedo ayudarte en tres cosas: crear una reserva, consultar tus reservas y modificar una reserva existente. ¿Qué opción prefieres?';
		}

		if ($this->isOutOfScopeIntent($input, $aiExtraction)) {
			$this->session->set_data('ai_flow_state', $state);
			$this->session->set_data('ai_flow_ctx', $ctx);
			return 'Lo siento, no puedo ayudar con ese tema. Puedo ayudarte a crear una reserva, consultar tus reservas o modificar una reserva existente. ¿Qué opción prefieres?';
		}

		if (!empty($aiExtraction['reset']) && $aiExtraction['reset'] === 'yes') {
			$this->session->set_data('ai_flow_state', 'WELCOME');
			$this->session->set_data('ai_flow_ctx', array());
			return $this->generateAgentReplyWithGroq('WELCOME', array(), 'Saluda y explica que se ha reiniciado el flujo. Pregunta si desea nueva reserva, consultar reservas o modificar una reserva.');
		}

		if (!empty($aiExtraction['intent']) && in_array($aiExtraction['intent'], array('new_booking', 'my_bookings', 'modify_booking'))) {
			if ($aiExtraction['intent'] === 'new_booking') {
				$ctx['pending_action'] = 'NEW_BOOKING';
			} elseif ($aiExtraction['intent'] === 'my_bookings') {
				$ctx['pending_action'] = 'MY_BOOKINGS';
			} else {
				$ctx['pending_action'] = 'MODIFY_BOOKING';
			}
		}

		if ($this->isModifyBookingIntent($input)) {
			$ctx['pending_action'] = 'MODIFY_BOOKING';
		}

		for ($guard = 0; $guard < 8; $guard++) {
			$this->log("[AI_FLOW] Estado actual: " . $state . " | Contexto: " . json_encode($ctx), PEAR_LOG_INFO);

			switch ($state) {
				case 'WELCOME':
					$state = 'WAITING_ACTION';
					$this->session->set_data('ai_flow_state', $state);
					$this->session->set_data('ai_flow_ctx', $ctx);
					if (empty($ctx['pending_action'])) {
						return $this->generateAgentReplyWithGroq($state, $ctx, 'Da la bienvenida al sistema inteligente de Hotel MonteLuz y pregunta si quiere nueva reserva, consultar reservas o modificar una reserva existente.');
					}
					continue;

				case 'WAITING_ACTION':
					if (empty($ctx['pending_action'])) {
						$this->session->set_data('ai_flow_state', $state);
						$this->session->set_data('ai_flow_ctx', $ctx);
						return $this->generateAgentReplyWithGroq($state, $ctx, 'Pide al usuario que indique si desea nueva reserva, consultar reservas o modificar una reserva existente.');
					}
					$state = 'ASK_PHONE';
					continue;

				case 'ASK_PHONE':
					if (!$this->isCaptureAcceptedByAi('ASK_PHONE', $ctxBeforeMerge, $ctx, $aiExtraction)) {
						$this->session->set_data('ai_flow_state', $state);
						$this->session->set_data('ai_flow_ctx', $ctx);
						return $this->generateAgentReplyWithGroq($state, $ctx, 'Pide o repite la solicitud del número de teléfono desde el que quiere realizar la reserva.');
					}
					$state = 'ASK_DNI';
					continue;

				case 'ASK_DNI':
					if (!$this->isCaptureAcceptedByAi('ASK_DNI', $ctxBeforeMerge, $ctx, $aiExtraction)) {
						$this->session->set_data('ai_flow_state', $state);
						$this->session->set_data('ai_flow_ctx', $ctx);
						return $this->generateAgentReplyWithGroq($state, $ctx, 'Pide o repite la solicitud del DNI completo junto con la letra.');
					}
					$state = 'CHECK_USER';
					continue;

				case 'CHECK_USER':
					$usuario = $this->findUserByPhoneOrDni($ctx['telefono'], $ctx['dniCompleto']);
					if (!empty($usuario)) {
						if (empty($ctx['dniCompleto']) && !empty($usuario['documento_identidad'])) {
							$ctx['dniCompleto'] = $usuario['documento_identidad'];
						}
						if (empty($ctx['telefono']) && !empty($usuario['telefono'])) {
							$ctx['telefono'] = $usuario['telefono'];
						}
						$ctx['id_usuario'] = $usuario['id_usuario'];
						$this->session->set_data('idUsuario', $usuario['id_usuario']);
						$this->session->set_data('dniCompleto', $ctx['dniCompleto']);
						$this->session->set_data('telefono', $ctx['telefono']);

						if (isset($ctx['pending_action']) && $ctx['pending_action'] === 'MY_BOOKINGS') {
							$state = 'AUTH_MENU';
							unset($ctx['pending_action']);
							$this->session->set_data('ai_flow_state', $state);
							$this->session->set_data('ai_flow_ctx', $ctx);
							$resumen = $this->buildUserBookingsSummary($ctx['id_usuario']);
							return $resumen;
						}

						if (isset($ctx['pending_action']) && $ctx['pending_action'] === 'MODIFY_BOOKING') {
							$state = 'MODIFY_SELECT_BOOKING';
							unset($ctx['pending_action']);
							$this->session->set_data('ai_flow_state', $state);
							$this->session->set_data('ai_flow_ctx', $ctx);
							$dataModificar = $this->buildFutureBookingsOptionsForModification($ctx['id_usuario']);
							$this->session->set_data('reserva_modificar_opciones', $dataModificar['options']);
							if (!empty($dataModificar['single']) && !empty($dataModificar['selected'])) {
								$this->session->set_data('reserva_modificar_original', $dataModificar['selected']);
								$state = 'MODIFY_CONFIRM_SINGLE';
								$this->session->set_data('ai_flow_state', $state);
							}
							return $dataModificar['message'];
						}

						$state = 'ASK_CHECKIN';
						continue;
					}

					$state = 'ASK_CP';
					continue;

				case 'ASK_CP':
					if (!$this->isCaptureAcceptedByAi('ASK_CP', $ctxBeforeMerge, $ctx, $aiExtraction)) {
						$this->session->set_data('ai_flow_state', $state);
						$this->session->set_data('ai_flow_ctx', $ctx);
						return $this->generateAgentReplyWithGroq($state, $ctx, 'Explica que no existe cuenta y pide o repite la solicitud del código postal en 5 dígitos para poder crearla.');
					}

					if (isset($ctx['pending_action']) && in_array($ctx['pending_action'], array('MY_BOOKINGS', 'MODIFY_BOOKING'))) {
						$state = 'AUTH_MENU';
						unset($ctx['pending_action']);
						$this->session->set_data('ai_flow_state', $state);
						$this->session->set_data('ai_flow_ctx', $ctx);
						return 'No encuentro una cuenta existente con esos datos, así que no puedo consultar o modificar reservas. ¿Desea crear una nueva reserva?';
					}

					$idUsuario = $this->createUserFromContext($ctx);
					if (empty($idUsuario)) {
						$this->session->set_data('ai_flow_state', $state);
						$this->session->set_data('ai_flow_ctx', $ctx);
						return $this->generateAgentReplyWithGroq($state, $ctx, 'Informa de un error técnico al crear usuario y pide intentar más tarde.');
					}

					$ctx['id_usuario'] = $idUsuario;
					$this->session->set_data('idUsuario', $idUsuario);
					$this->session->set_data('dniCompleto', $ctx['dniCompleto']);
					$this->session->set_data('telefono', $ctx['telefono']);

					if (isset($ctx['pending_action']) && $ctx['pending_action'] === 'MY_BOOKINGS') {
						$state = 'AUTH_MENU';
						$this->session->set_data('ai_flow_state', $state);
						$this->session->set_data('ai_flow_ctx', $ctx);
						return $this->generateAgentReplyWithGroq($state, $ctx, 'Indica que el usuario se creó correctamente y que no tiene reservas aún. Ofrece iniciar una nueva reserva.');
					}

					$state = 'ASK_CHECKIN';
					continue;

				case 'ASK_CHECKIN':
					if (!$this->isCaptureAcceptedByAi('ASK_CHECKIN', $ctxBeforeMerge, $ctx, $aiExtraction)) {
						$this->session->set_data('ai_flow_state', $state);
						$this->session->set_data('ai_flow_ctx', $ctx);
						return $this->generateAgentReplyWithGroq($state, $ctx, 'Pide o repite la fecha de entrada al hotel con formato claro.');
					}

					$ctx = $this->syncStayDatesFromContext($ctx);
					if (!empty($ctx['fecha_entrada']) && isset($ctx['ultima_busqueda_sin_disponibilidad'])) {
						unset($ctx['ultima_busqueda_sin_disponibilidad']);
					}

					$state = 'ASK_CHECKOUT';
					continue;

				case 'ASK_CHECKOUT':
					$ctx = $this->syncStayDatesFromContext($ctx);
					if (!empty($ctx['fecha_salida']) && isset($ctx['ultima_busqueda_sin_disponibilidad'])) {
						unset($ctx['ultima_busqueda_sin_disponibilidad']);
					}

					if (!$this->isCaptureAcceptedByAi('ASK_CHECKOUT', $ctxBeforeMerge, $ctx, $aiExtraction)) {
						$this->session->set_data('ai_flow_state', $state);
						$this->session->set_data('ai_flow_ctx', $ctx);
						return $this->generateAgentReplyWithGroq($state, $ctx, 'Pide o repite la fecha de salida del hotel o el número de noches que se quiere hospedar.');
					}

					if (strtotime($ctx['fecha_salida']) <= strtotime($ctx['fecha_entrada'])) {
						unset($ctx['fecha_salida']);
						$this->session->set_data('ai_flow_state', $state);
						$this->session->set_data('ai_flow_ctx', $ctx);
						return $this->generateAgentReplyWithGroq($state, $ctx, 'Indica que la salida debe ser posterior a la entrada y vuelve a pedir dato válido.');
					}

					$state = 'ASK_PEOPLE';
					continue;

				case 'ASK_PEOPLE':
					if (!$this->isCaptureAcceptedByAi('ASK_PEOPLE', $ctxBeforeMerge, $ctx, $aiExtraction)) {
						$this->session->set_data('ai_flow_state', $state);
						$this->session->set_data('ai_flow_ctx', $ctx);
						return $this->generateAgentReplyWithGroq($state, $ctx, 'Pide o repite cuántas personas se alojarán en la reserva.');
					}

					$availability = $this->checkAvailabilityForFlow($ctx['fecha_entrada'], $ctx['fecha_salida'], $ctx['personas']);
					if (empty($availability) || empty($availability['rooms'])) {
						$ctx['ultima_busqueda_sin_disponibilidad'] = array(
							'fecha_entrada' => isset($ctx['fecha_entrada']) ? $ctx['fecha_entrada'] : null,
							'fecha_salida' => isset($ctx['fecha_salida']) ? $ctx['fecha_salida'] : null,
							'noches' => isset($ctx['noches']) ? $ctx['noches'] : null,
							'personas' => isset($ctx['personas']) ? $ctx['personas'] : null
						);
						unset($ctx['fecha_entrada'], $ctx['fecha_salida'], $ctx['noches']);
						$state = 'ASK_CHECKIN';
						$this->session->set_data('ai_flow_state', $state);
						$this->session->set_data('ai_flow_ctx', $ctx);
						return $this->generateAgentReplyWithGroq(
							$state,
							$ctx,
							'Indica que no hay disponibilidad y pide nuevas fechas, manteniendo referencia breve a los datos anteriores para continuidad.',
							array('ultima_busqueda_sin_disponibilidad' => $ctx['ultima_busqueda_sin_disponibilidad'])
						);
					}

					$rooms = $availability['rooms'];
					$diasEstancia = $availability['dias'];

					$this->session->set_data('result', $rooms);
					$reservaPrevia = array(
						'id_usuario' => $ctx['id_usuario'],
						'id_habitacion' => $rooms[0]['id_habitacion'],
						'fecha_entrada' => $ctx['fecha_entrada'],
						'fecha_salida' => $ctx['fecha_salida'],
						'numero_personas' => $ctx['personas']
					);
					$this->session->set_data('reservaPrevia', $reservaPrevia);

					$state = 'CONFIRM_FIRST_OPTION';
					$this->session->set_data('ai_flow_state', $state);
					$this->session->set_data('ai_flow_ctx', $ctx);

					$descripcion = !empty($rooms[0]['descripcion']) ? $rooms[0]['descripcion'] : 'habitación';
					$personasReserva = !empty($ctx['personas']) ? (int)$ctx['personas'] : 0;
					$personasTxt = $personasReserva === 1 ? '1 persona' : ($personasReserva . ' personas');
					$nombre = !empty($ctx['nombre']) ? $ctx['nombre'] : '';
					$nombreTxt = $nombre !== '' ? ', ' . $nombre : '';

					$respuesta = 'Tenemos una habitación disponible para ' . $personasTxt . $nombreTxt . '. '
						. 'Descripción completa de la habitación: ' . $descripcion . '.';
					$respuesta .= ' ¿Desea confirmar la reserva?';
					return $respuesta;

				case 'CONFIRM_FIRST_OPTION':
					if (!empty($aiExtraction['confirm']) && $aiExtraction['confirm'] === 'yes') {
						$reservaPrevia = $this->session->get_data('reservaPrevia');
						if ($this->createReservationFromArray($reservaPrevia)) {
							$state = 'AUTH_MENU';
							$this->session->set_data('ai_flow_state', $state);
							$this->session->set_data('ai_flow_ctx', $ctx);
							return $this->generateAgentReplyWithGroq($state, $ctx, 'Confirma que la reserva se ha creado correctamente en BBDD y pregunta si desea realizar alguna gestión más.');
						}
						$this->session->set_data('ai_flow_state', $state);
						$this->session->set_data('ai_flow_ctx', $ctx);
						return $this->generateAgentReplyWithGroq($state, $ctx, 'Informa de que no se pudo crear la reserva en BBDD por error técnico y pregunta si desea realizar otra gestión.');
					}

					if (!empty($aiExtraction['confirm']) && $aiExtraction['confirm'] === 'no') {
						$rooms = $this->session->get_data('result');
						$reservaFinal = array();
						$resumenOpciones = array();
						$noches = !empty($ctx['noches']) ? (int)$ctx['noches'] : 0;

						if (!is_array($rooms)) {
							$rooms = array();
						}

						$maxAlternativas = 3;
						$idx = 1;
						for ($i = 1; $i < count($rooms) && $idx <= $maxAlternativas; $i++) {
							$room = $rooms[$i];
							if (empty($room['id_habitacion'])) {
								continue;
							}

							$precioNoche = isset($room['precio_noche']) ? (float)$room['precio_noche'] : null;
							$precioTotal = ($precioNoche !== null && $noches > 0) ? ($precioNoche * $noches) : null;
							$descripcion = !empty($room['descripcion']) ? $room['descripcion'] : 'habitación';

							$reservaFinal[$idx] = array(
								'id_usuario' => $ctx['id_usuario'],
								'id_habitacion' => $room['id_habitacion'],
								'fecha_entrada' => $ctx['fecha_entrada'],
								'fecha_salida' => $ctx['fecha_salida'],
								'numero_personas' => $ctx['personas']
							);

							$textoOpcion = 'Opción ' . $idx . ': ' . $descripcion;
							if ($precioNoche !== null) {
								$textoOpcion .= ', ' . number_format($precioNoche, 0, ',', '.') . ' euros por noche';
							}
							if ($precioTotal !== null) {
								$textoOpcion .= ', total ' . number_format($precioTotal, 0, ',', '.') . ' euros';
							}
							$resumenOpciones[] = $textoOpcion;
							$idx++;
						}

						if (empty($reservaFinal)) {
							$state = 'AUTH_MENU';
							$this->session->set_data('ai_flow_state', $state);
							$this->session->set_data('ai_flow_ctx', $ctx);
							return 'No hay más habitaciones disponibles para esas fechas. ¿Desea realizar alguna otra gestión?';
						}

						$this->session->set_data('reservaFinal', $reservaFinal);
						$state = 'CHOOSE_OTHER_OPTION';
						$this->session->set_data('ai_flow_state', $state);
						$this->session->set_data('ai_flow_ctx', $ctx);
						return 'Entendido, le ofrezco otras habitaciones disponibles. ' . implode('. ', $resumenOpciones) . '. Indíqueme el número de opción que prefiere.';
					}

					$this->session->set_data('ai_flow_state', $state);
					$this->session->set_data('ai_flow_ctx', $ctx);
					return $this->generateAgentReplyWithGroq($state, $ctx, 'Pide una respuesta clara de confirmación sí o no.');

				case 'CHOOSE_OTHER_OPTION':
					$reservaFinal = $this->session->get_data('reservaFinal');
					$opcion = !empty($aiExtraction['opcion']) ? (int)$aiExtraction['opcion'] : null;

					if ((!empty($aiExtraction['confirm']) && $aiExtraction['confirm'] === 'no') || $this->isNoMoreIntent($input)) {
						$state = 'AUTH_MENU';
						$this->session->set_data('ai_flow_state', $state);
						$this->session->set_data('ai_flow_ctx', $ctx);
						return 'Perfecto, no se ha seleccionado ninguna habitación alternativa. ¿Desea realizar alguna otra gestión?';
					}

					if (empty($opcion) || !isset($reservaFinal[$opcion])) {
						$this->session->set_data('ai_flow_state', $state);
						$this->session->set_data('ai_flow_ctx', $ctx);
						return 'La opción indicada no es válida. Por favor, dígame el número de la habitación que desea reservar.';
					}

					if ($this->createReservationFromArray($reservaFinal[$opcion])) {
						$state = 'AUTH_MENU';
						$this->session->set_data('ai_flow_state', $state);
						$this->session->set_data('ai_flow_ctx', $ctx);
						return $this->generateAgentReplyWithGroq($state, $ctx, 'Confirma reserva alternativa y ofrece siguiente acción.');
					}

					$this->session->set_data('ai_flow_state', $state);
					$this->session->set_data('ai_flow_ctx', $ctx);
					return $this->generateAgentReplyWithGroq($state, $ctx, 'Informa de error técnico al confirmar alternativa y pide reintentar.');

				case 'MODIFY_SELECT_BOOKING':
					$opcionesModificar = $this->session->get_data('reserva_modificar_opciones');
					$opcionModificar = !empty($aiExtraction['opcion']) ? (int)$aiExtraction['opcion'] : null;

					if (!is_array($opcionesModificar) || empty($opcionesModificar)) {
						$state = 'AUTH_MENU';
						$this->session->set_data('ai_flow_state', $state);
						$this->session->set_data('ai_flow_ctx', $ctx);
						return 'No encuentro reservas futuras para modificar. ¿Desea realizar alguna otra gestión?';
					}

					if (empty($opcionModificar) || !isset($opcionesModificar[$opcionModificar])) {
						$this->session->set_data('ai_flow_state', $state);
						$this->session->set_data('ai_flow_ctx', $ctx);
						return 'Indíqueme el número de la opción de reserva que desea modificar.';
					}

					$this->session->set_data('reserva_modificar_original', $opcionesModificar[$opcionModificar]);
					$state = 'MODIFY_CHOOSE_FIELD';
					$this->session->set_data('ai_flow_state', $state);
					$this->session->set_data('ai_flow_ctx', $ctx);
					return 'Perfecto. ¿Qué desea modificar de esa reserva: fecha de entrada, fecha de salida o número de personas?';

				case 'MODIFY_CONFIRM_SINGLE':
					if (!empty($aiExtraction['confirm']) && $aiExtraction['confirm'] === 'yes') {
						$state = 'MODIFY_CHOOSE_FIELD';
						$this->session->set_data('ai_flow_state', $state);
						$this->session->set_data('ai_flow_ctx', $ctx);
						return 'Perfecto. ¿Qué desea modificar de esa reserva: fecha de entrada, fecha de salida o número de personas?';
					}

					if (!empty($aiExtraction['confirm']) && $aiExtraction['confirm'] === 'no') {
						$state = 'AUTH_MENU';
						$this->session->set_data('ai_flow_state', $state);
						$this->session->set_data('ai_flow_ctx', $ctx);
						return 'De acuerdo, no modificamos esa reserva. ¿Desea realizar alguna otra gestión?';
					}

					$this->session->set_data('ai_flow_state', $state);
					$this->session->set_data('ai_flow_ctx', $ctx);
					return '¿Quiere modificar esa reserva? Responda sí o no.';

				case 'MODIFY_CHOOSE_FIELD':
					$campoModificar = $this->detectReservationFieldToModify($input);
					if (empty($campoModificar)) {
						$this->session->set_data('ai_flow_state', $state);
						$this->session->set_data('ai_flow_ctx', $ctx);
						return 'Dígame qué desea cambiar: fecha de entrada, fecha de salida o número de personas.';
					}

					$ctx['campo_modificar'] = $campoModificar;
					if ($campoModificar === 'fecha_entrada') {
						$state = 'MODIFY_NEW_CHECKIN';
						$this->session->set_data('ai_flow_state', $state);
						$this->session->set_data('ai_flow_ctx', $ctx);
						return 'Indíqueme la nueva fecha de entrada.';
					}

					if ($campoModificar === 'fecha_salida') {
						$state = 'MODIFY_NEW_CHECKOUT';
						$this->session->set_data('ai_flow_state', $state);
						$this->session->set_data('ai_flow_ctx', $ctx);
						return 'Indíqueme la nueva fecha de salida o el nuevo número de noches.';
					}

					$state = 'MODIFY_NEW_PEOPLE';
					$this->session->set_data('ai_flow_state', $state);
					$this->session->set_data('ai_flow_ctx', $ctx);
					return 'Indíqueme el nuevo número de personas para la reserva.';

				case 'MODIFY_NEW_CHECKIN':
					$reservaOriginal = $this->session->get_data('reserva_modificar_original');
					$nuevaEntrada = !empty($aiExtraction['fecha_entrada']) ? $this->normalizeIsoDate($aiExtraction['fecha_entrada']) : null;
					if (empty($nuevaEntrada)) {
						$this->session->set_data('ai_flow_state', $state);
						$this->session->set_data('ai_flow_ctx', $ctx);
						return 'No he entendido la nueva fecha de entrada. Dígamela de nuevo, por favor.';
					}

					if (empty($reservaOriginal) || !is_array($reservaOriginal)) {
						$state = 'AUTH_MENU';
						$this->session->set_data('ai_flow_state', $state);
						$this->session->set_data('ai_flow_ctx', $ctx);
						return 'No encuentro la reserva original para modificarla. ¿Desea realizar otra gestión?';
					}

					$nuevaReserva = $reservaOriginal;
					$nuevaReserva['fecha_entrada'] = $nuevaEntrada;
					$nochesOriginales = null;
					if (!empty($reservaOriginal['fecha_entrada']) && !empty($reservaOriginal['fecha_salida'])) {
						$feOriginal = new DateTime($reservaOriginal['fecha_entrada']);
						$fsOriginal = new DateTime($reservaOriginal['fecha_salida']);
						$nochesOriginales = $feOriginal->diff($fsOriginal)->days;
					}
					if (!empty($nochesOriginales)) {
						$nuevaReserva['fecha_salida'] = date('Y-m-d', strtotime($nuevaEntrada . ' +' . $nochesOriginales . ' day'));
					}

					if (!$this->replaceReservationByData($reservaOriginal, $nuevaReserva)) {
						$this->session->set_data('ai_flow_state', $state);
						$this->session->set_data('ai_flow_ctx', $ctx);
						return 'No he podido modificar la reserva en este momento. ¿Desea que lo intentemos de nuevo?';
					}

					$state = 'AUTH_MENU';
					$this->session->set_data('ai_flow_state', $state);
					$this->session->set_data('ai_flow_ctx', $ctx);
					return 'Reserva modificada correctamente con la nueva fecha de entrada. ¿Desea realizar alguna otra gestión?';

				case 'MODIFY_NEW_CHECKOUT':
					$reservaOriginal = $this->session->get_data('reserva_modificar_original');
					$nuevaSalida = !empty($aiExtraction['fecha_salida']) ? $this->normalizeIsoDate($aiExtraction['fecha_salida']) : null;
					if (empty($nuevaSalida) && !empty($aiExtraction['noches']) && !empty($reservaOriginal['fecha_entrada'])) {
						$nuevaSalida = date('Y-m-d', strtotime($reservaOriginal['fecha_entrada'] . ' +' . ((int)$aiExtraction['noches']) . ' day'));
					}

					if (empty($nuevaSalida)) {
						$this->session->set_data('ai_flow_state', $state);
						$this->session->set_data('ai_flow_ctx', $ctx);
						return 'No he entendido la nueva salida. Indíqueme la nueva fecha de salida o las noches.';
					}

					if (empty($reservaOriginal) || !is_array($reservaOriginal)) {
						$state = 'AUTH_MENU';
						$this->session->set_data('ai_flow_state', $state);
						$this->session->set_data('ai_flow_ctx', $ctx);
						return 'No encuentro la reserva original para modificarla. ¿Desea realizar otra gestión?';
					}

					if (strtotime($nuevaSalida) <= strtotime($reservaOriginal['fecha_entrada'])) {
						$this->session->set_data('ai_flow_state', $state);
						$this->session->set_data('ai_flow_ctx', $ctx);
						return 'La nueva fecha de salida debe ser posterior a la entrada. Dígame otra fecha, por favor.';
					}

					$nuevaReserva = $reservaOriginal;
					$nuevaReserva['fecha_salida'] = $nuevaSalida;
					if (!$this->replaceReservationByData($reservaOriginal, $nuevaReserva)) {
						$this->session->set_data('ai_flow_state', $state);
						$this->session->set_data('ai_flow_ctx', $ctx);
						return 'No he podido modificar la reserva en este momento. ¿Desea que lo intentemos de nuevo?';
					}

					$state = 'AUTH_MENU';
					$this->session->set_data('ai_flow_state', $state);
					$this->session->set_data('ai_flow_ctx', $ctx);
					return 'Reserva modificada correctamente con la nueva fecha de salida. ¿Desea realizar alguna otra gestión?';

				case 'MODIFY_NEW_PEOPLE':
					$reservaOriginal = $this->session->get_data('reserva_modificar_original');
					$nuevasPersonas = !empty($aiExtraction['personas']) ? (int)$aiExtraction['personas'] : $this->extractPeople($input);

					if (empty($nuevasPersonas) || $nuevasPersonas < 1) {
						$this->session->set_data('ai_flow_state', $state);
						$this->session->set_data('ai_flow_ctx', $ctx);
						return 'No he entendido el nuevo número de personas. Indíquelo de nuevo, por favor.';
					}

					if (empty($reservaOriginal) || !is_array($reservaOriginal)) {
						$state = 'AUTH_MENU';
						$this->session->set_data('ai_flow_state', $state);
						$this->session->set_data('ai_flow_ctx', $ctx);
						return 'No encuentro la reserva original para modificarla. ¿Desea realizar otra gestión?';
					}

					$nuevaReserva = $reservaOriginal;
					$nuevaReserva['numero_personas'] = $nuevasPersonas;
					if (!$this->replaceReservationByData($reservaOriginal, $nuevaReserva)) {
						$this->session->set_data('ai_flow_state', $state);
						$this->session->set_data('ai_flow_ctx', $ctx);
						return 'No he podido modificar la reserva en este momento. ¿Desea que lo intentemos de nuevo?';
					}

					$state = 'AUTH_MENU';
					$this->session->set_data('ai_flow_state', $state);
					$this->session->set_data('ai_flow_ctx', $ctx);
					return 'Reserva modificada correctamente con el nuevo número de personas. ¿Desea realizar alguna otra gestión?';

				case 'AUTH_MENU':
					if (isset($ctx['pending_action']) && $ctx['pending_action'] === 'NEW_BOOKING') {
						$state = 'ASK_CHECKIN';
						continue;
					}

					if (isset($ctx['pending_action']) && $ctx['pending_action'] === 'MY_BOOKINGS') {
						unset($ctx['pending_action']);
						$this->session->set_data('ai_flow_state', $state);
						$this->session->set_data('ai_flow_ctx', $ctx);
						$resumen = $this->buildUserBookingsSummary($ctx['id_usuario']);
						return $resumen;
					}

					if (isset($ctx['pending_action']) && $ctx['pending_action'] === 'MODIFY_BOOKING') {
						unset($ctx['pending_action']);
						$state = 'MODIFY_SELECT_BOOKING';
						$this->session->set_data('ai_flow_state', $state);
						$this->session->set_data('ai_flow_ctx', $ctx);
						$dataModificar = $this->buildFutureBookingsOptionsForModification($ctx['id_usuario']);
						$this->session->set_data('reserva_modificar_opciones', $dataModificar['options']);
						if (!empty($dataModificar['single']) && !empty($dataModificar['selected'])) {
							$this->session->set_data('reserva_modificar_original', $dataModificar['selected']);
							$state = 'MODIFY_CONFIRM_SINGLE';
							$this->session->set_data('ai_flow_state', $state);
						}
						return $dataModificar['message'];
					}

					if ((!empty($aiExtraction['end']) && $aiExtraction['end'] === 'yes') || $this->isNoMoreIntent($input)) {
						$this->session->set_data('ai_flow_state', 'WELCOME');
						$this->session->set_data('ai_flow_ctx', array());
						$this->log("[AI_FLOW] Accion interpretada por el agente: colgar", PEAR_LOG_INFO);
						$this->session->set_data('agent_action', 'colgar');
						return $this->generateAgentReplyWithGroq('WELCOME', array(), 'Despedida breve y amable de cierre de llamada.');
					}

					$this->session->set_data('ai_flow_state', $state);
					$this->session->set_data('ai_flow_ctx', $ctx);
					return $this->generateAgentReplyWithGroq($state, $ctx, 'Pregunta si desea nueva reserva, consultar reservas o modificar una reserva.');

				default:
					$state = 'WELCOME';
					$ctx = array();
					$this->session->set_data('ai_flow_state', $state);
					$this->session->set_data('ai_flow_ctx', $ctx);
					return $this->generateAgentReplyWithGroq($state, $ctx, 'Reinicia conversación y pregunta necesidad principal.');
			}
		}

		$this->session->set_data('ai_flow_state', $state);
		$this->session->set_data('ai_flow_ctx', $ctx);
		return $this->generateAgentReplyWithGroq($state, $ctx, 'Pide al usuario repetir lo último para continuar.');
	}

	private function generateAgentReplyWithGroq($state, $ctx, $instruction, $facts = array()) {
		$apiKey = $this->geminiApiKey;
		if (empty($apiKey)) {
			$this->log("[AI_REPLY] API key no configurada para Gemini", PEAR_LOG_ERR);
			return "Lo siento, ahora mismo no puedo responder por un problema de configuración. ¿Me lo repites en unos segundos?";
		}
		$recentReplies = $this->session->get_data('ai_flow_recent_replies');
		if (!is_array($recentReplies)) {
			$recentReplies = array();
		}

		$system = "Eres la voz del IVR del Hotel MonteLuz. "
			. "Debes responder SOLO con el texto exacto que el sistema dirá al usuario. "
			. "Tu respuesta debe caber en una locución de menos de 6 segundos."
			. "Se educado, pero no comiences todas las frases diciendo porfavor o similares. Puedes hacerlo solo en casos puntuales, no siempre."
			. "No uses JSON, no uses etiquetas, no uses prefijos. "
			. "Sé natural, claro y breve. Máximo 2 frases. "
			. "Solo puedes saludar o decir 'Bienvenido/a' cuando el estado sea WELCOME. "
			. "Si en el contexto hay un nombre de usuario, puedes usarlo en algunos turnos de forma natural, pero no siempre. "
			. "Varía siempre la formulación y evita repetir estructuras de frase de turnos anteriores. "
			. "Si el usuario da una respuesta irrelevante, ambigua o intenta hablar de otra cosa que no tenga que ver con el hotel monte Luz, guíalo de nuevo con una pregunta clara relacionada con el flujo actual."
			. "Tu estilo debe sonar humano, cercano y nada robótico.";

		$user = "Estado: " . $state
			. "\nContexto: " . json_encode($ctx)
			. "\nHechos extra: " . json_encode($facts)
			. "\nÚltimas respuestas dadas (evitar repetir): " . json_encode($recentReplies)
			. "\nObjetivo de respuesta: " . $instruction;

		$payload = array(
			"contents" => array(
				array(
					"parts" => array(
						array("text" => $system . "\n\n" . $user)
					)
				)
			),
			"generationConfig" => array(
				"temperature" => 0.2,
				"maxOutputTokens" => 400
			)
		);

		$this->log("[AI_REPLY] SYSTEM PROMPT: " . $system, PEAR_LOG_INFO);
		$this->log("[AI_REPLY] USER PROMPT: " . $user, PEAR_LOG_INFO);
		$this->log("[AI_REPLY] PAYLOAD: " . json_encode($payload), PEAR_LOG_INFO);


		$call = $this->callGeminiApi($payload, $apiKey, $this->geminiModelReply, 'AI_REPLY');
		$response = $call['response'];
		$httpCode = $call['httpCode'];
		$curlError = $call['curlError'];

		$this->log("[AI_REPLY] HTTP CODE: " . $httpCode, PEAR_LOG_INFO);


		$data = json_decode($response, true);

		if (json_last_error() === JSON_ERROR_NONE) {
			$responseCompact = json_encode($data, JSON_UNESCAPED_UNICODE);
		} else {
			// fallback si no es JSON válido
			$responseCompact = str_replace(["\n", "\r", "\t"], '', $response);
		}

		$this->log("[AI_REPLY] RAW RESPONSE: " . $responseCompact, PEAR_LOG_INFO);


		if ($curlError) {
			$this->log("[AI_REPLY] CURL ERROR: " . $curlError, PEAR_LOG_ERR);
			return "Lo siento, ha ocurrido un error técnico. ¿Puedes repetirlo, por favor?";
		}

		if ($httpCode !== 200) {
			$this->log("[AI_REPLY] ERROR HTTP: " . $httpCode, PEAR_LOG_ERR);
			return "Lo siento, ahora mismo no puedo responder correctamente. ¿Me lo repites, por favor?";
		}

		$result = json_decode($response, true);
		//$this->log("[AI_REPLY] PARSED RESPONSE: " . print_r($result, true), PEAR_LOG_INFO);

		if (!isset($result['candidates'][0]['content']['parts'][0]['text'])) {
			return "Perdona, no he podido procesarlo bien. ¿Puedes repetirlo?";
		}

		$text = trim($result['candidates'][0]['content']['parts'][0]['text']);
		if ($text === '') {
			return "Perdona, ¿puedes repetírmelo?";
		}

		$recentReplies[] = $text;
		if (count($recentReplies) > 4) {
			$recentReplies = array_slice($recentReplies, -4);
		}
		$this->session->set_data('ai_flow_recent_replies', $recentReplies);

		return $text;
	}

	private function extractFlowDataWithGemini($input, $state, $ctx) {
		$apiKey = $this->geminiApiKey;
		if (empty($apiKey)) {
			$this->log("[AI_EXTRACT] API key no configurada para Gemini", PEAR_LOG_ERR);
			return array();
		}
		$today = date('Y-m-d');
		$expectedField = '';
		switch ($state) {
			case 'ASK_PHONE':
				$expectedField = 'telefono';
				break;
			case 'ASK_DNI':
				$expectedField = 'dni';
				break;
			case 'ASK_CP':
				$expectedField = 'cp';
				break;
			case 'ASK_CHECKIN':
				$expectedField = 'fecha_entrada';
				break;
			case 'ASK_CHECKOUT':
				$expectedField = 'fecha_salida|noches';
				break;
			case 'ASK_PEOPLE':
				$expectedField = 'personas';
				break;
			case 'CONFIRM_FIRST_OPTION':
				$expectedField = 'confirm';
				break;
			case 'CHOOSE_OTHER_OPTION':
				$expectedField = 'opcion';
				break;
			case 'MODIFY_SELECT_BOOKING':
				$expectedField = 'opcion';
				break;
			case 'MODIFY_CONFIRM_SINGLE':
				$expectedField = 'confirm';
				break;
			case 'MODIFY_NEW_CHECKIN':
				$expectedField = 'fecha_entrada';
				break;
			case 'MODIFY_NEW_CHECKOUT':
				$expectedField = 'fecha_salida|noches';
				break;
			case 'MODIFY_NEW_PEOPLE':
				$expectedField = 'personas';
				break;
			default:
				$expectedField = 'intent';
		}

		$schema = array(
			"intent" => "new_booking|my_bookings|modify_booking|unknown",
			"nombre" => "string|null",
			"telefono" => "string|null",
			"dni" => "string|null",
			"cp" => "string|null",
			"fecha_entrada" => "YYYY-MM-DD|null",
			"fecha_salida" => "YYYY-MM-DD|null",
			"noches" => "number|null",
			"personas" => "number|null",
			"confirm" => "yes|no|unknown",
			"opcion" => "number|null",
			"capture_ok" => "yes|no|unknown",
			"capture_field" => "nombre|telefono|dni|cp|fecha_entrada|fecha_salida|noches|personas|confirm|opcion|none",
			"end" => "yes|no",
			"reset" => "yes|no"
		);

		$system = "Eres un normalizador de datos para un IVR hotelero. "
			. "Si no puedes completar TODO el JSON correctamente, devuelve igualmente un JSON válido con los campos disponibles y el resto null."
			. "Hoy es " . $today . ". "
			. "Debes interpretar español natural, números hablados y fechas relativas (manana, pasado manana, la semana que viene), "
			. "y convertirlos al esquema pedido. "
			. "Si el usuario indica su nombre (por ejemplo 'me llamo Ana'), devuelve nombre en formato de nombre propio (solo texto del nombre). "
			. "DNI debe quedar en formato 8 digitos + letra en mayuscula (ej: 12345678Z). "
			. "Telefono en 9 digitos sin espacios. "
			. "No sobrescribas valores ya capturados salvo que el usuario los corrija explícitamente."
			. "CP en 5 digitos. "
			. "MUY IMPORTANTE: no copies valores del contexto en la salida a menos que el usuario los haya dicho en ESTE turno. "
			. "capture_ok='yes' solo si el dato es completo, válido y usable sin ambigüedad."
			. "Si el campo esperado no queda claro o incompleto, capture_ok='no'. Si no aplica, capture_ok='unknown'. "
			. "En capture_field indica el campo realmente capturado en este turno; si ninguno, usa 'none'. Valores válidos: nombre, telefono, dni, cp, fecha_entrada, fecha_salida, noches, personas, confirm, opcion, none. "
			. "En ASK_DNI, si el usuario dicta digito a digito (por ejemplo 'cinco cuatro cuatro cuatro ocho ocho tres cuatro z'), debes conservar TODOS los digitos y devolver exactamente 8 digitos + letra. "
			. "En estado ASK_CP, si el usuario dicta numeros hablados (ej: dos ocho siete cero tres), debes devolver cp='28703'. "
			. "En ASK_CHECKOUT: si el usuario dice noches y existe fecha_entrada, devuelve noches y tambien fecha_salida calculada. "
			. "En ASK_CHECKOUT: si el usuario dice fecha_salida y existe fecha_entrada, devuelve fecha_salida y tambien noches calculadas. "
			. "Si dicen solo noches y existe fecha_entrada en contexto, rellena noches. "
			. "Si un dato es ambiguo (por ejemplo teléfono incompleto), devuelve null y capture_ok='no'."
			. "Si no sabes un campo, pon null.";

		$user = "Estado actual: " . $state
			. "\nContexto actual: " . json_encode($ctx)
			. "\nCampo principal esperado en este turno: " . $expectedField
			. "\nTexto usuario: " . $input
			. "\nEsquema objetivo: " . json_encode($schema);

		$payload = array(
			"contents" => array(
				array(
					"parts" => array(
						array("text" => $system . "\n\n" . $user)
					)
				)
			),
			"generationConfig" => array(
				"temperature" => 0,
				"maxOutputTokens" => 400
			)
		);

		$this->log("[AI_EXTRACT] SYSTEM PROMPT: " . $system, PEAR_LOG_INFO);
		$this->log("[AI_EXTRACT] USER PROMPT: " . $user, PEAR_LOG_INFO);
		$this->log("[AI_EXTRACT] PAYLOAD: " . json_encode($payload), PEAR_LOG_INFO);

		$call = $this->callGeminiApi($payload, $apiKey, $this->geminiModelExtraction, 'AI_EXTRACT');
		$response = $call['response'];
		$httpCode = $call['httpCode'];
		$curlError = $call['curlError'];

		$this->log("[AI_EXTRACT] HTTP CODE: " . $httpCode, PEAR_LOG_INFO);

		$data = json_decode($response, true);

		if (json_last_error() === JSON_ERROR_NONE) {
			$responseCompact = json_encode($data, JSON_UNESCAPED_UNICODE);
		} else {
			// fallback si no es JSON válido
			$responseCompact = str_replace(["\n", "\r", "\t"], '', $response);
		}

		$this->log("[AI_REPLY] RAW RESPONSE: " . $responseCompact, PEAR_LOG_INFO);



		if ($curlError) {
			$this->log("[AI_FLOW] Error Gemini extracción: " . $curlError, PEAR_LOG_ERR);
			return array();
		}

		if ($httpCode !== 200) {
			$this->log("[AI_FLOW] Error HTTP Gemini extracción: " . $httpCode . " | " . $response, PEAR_LOG_ERR);
			return array();
		}

		$result = json_decode($response, true);
		if (!isset($result['candidates'][0]['content']['parts'][0]['text'])) {
			$this->log("[AI_FLOW] Respuesta Gemini extracción sin content", PEAR_LOG_ERR);
			return array();
		}

		//$this->log("[AI_EXTRACT] PARSED RESPONSE: " . print_r($result, true), PEAR_LOG_INFO);

		$content = trim($result['candidates'][0]['content']['parts'][0]['text']);
		$data = $this->decodeJsonObjectLenient($content);
		if (!is_array($data)) {
			$this->log("[AI_FLOW] JSON extracción inválido: " . $content, PEAR_LOG_ERR);
			return array();
		}

		return $data;
	}

	private function isCaptureAcceptedByAi($state, $ctxBeforeMerge, $ctxAfterMerge, $aiExtraction) {
		$fieldByState = array(
			'ASK_PHONE' => 'telefono',
			'ASK_DNI' => 'dniCompleto',
			'ASK_CP' => 'cp',
			'ASK_CHECKIN' => 'fecha_entrada',
			'ASK_CHECKOUT' => 'fecha_salida',
			'ASK_PEOPLE' => 'personas'
		);

		if (!isset($fieldByState[$state])) {
			return true;
		}

		$field = $fieldByState[$state];

		if (!empty($ctxBeforeMerge[$field])) {
			return true;
		}

		if (empty($ctxAfterMerge[$field])) {
			return false;
		}

		if (!is_array($aiExtraction)) {
			return false;
		}

		if (!empty($aiExtraction['capture_ok']) && $aiExtraction['capture_ok'] === 'yes') {
			return true;
		}

		if (in_array($state, array('ASK_PHONE', 'ASK_DNI', 'ASK_CP', 'ASK_CHECKIN', 'ASK_CHECKOUT', 'ASK_PEOPLE'))) {
			$this->log("[AI_FLOW] capture_ok no confirmado para " . $state . ", se solicita reintento", PEAR_LOG_INFO);
		}

		return false;
	}

	private function preserveExtractionContextOnEnd($aiExtraction, $ctx) {
		if (!is_array($aiExtraction)) {
			return array();
		}

		if (!is_array($ctx)) {
			$ctx = array();
		}

		if (empty($aiExtraction['end']) || $aiExtraction['end'] !== 'yes') {
			return $aiExtraction;
		}

		if (empty($aiExtraction['nombre']) && !empty($ctx['nombre'])) {
			$aiExtraction['nombre'] = $ctx['nombre'];
		}
		if (empty($aiExtraction['telefono']) && !empty($ctx['telefono'])) {
			$aiExtraction['telefono'] = $ctx['telefono'];
		}
		if (empty($aiExtraction['dni']) && !empty($ctx['dniCompleto'])) {
			$aiExtraction['dni'] = $ctx['dniCompleto'];
		}
		if (empty($aiExtraction['cp']) && !empty($ctx['cp'])) {
			$aiExtraction['cp'] = $ctx['cp'];
		}
		if (empty($aiExtraction['fecha_entrada']) && !empty($ctx['fecha_entrada'])) {
			$aiExtraction['fecha_entrada'] = $ctx['fecha_entrada'];
		}
		if (empty($aiExtraction['fecha_salida']) && !empty($ctx['fecha_salida'])) {
			$aiExtraction['fecha_salida'] = $ctx['fecha_salida'];
		}
		if (empty($aiExtraction['noches']) && !empty($ctx['noches'])) {
			$aiExtraction['noches'] = $ctx['noches'];
		}
		if (empty($aiExtraction['personas']) && !empty($ctx['personas'])) {
			$aiExtraction['personas'] = $ctx['personas'];
		}

		if ((!isset($aiExtraction['intent']) || $aiExtraction['intent'] === 'unknown' || $aiExtraction['intent'] === null) && !empty($ctx['pending_action'])) {
			if ($ctx['pending_action'] === 'NEW_BOOKING') {
				$aiExtraction['intent'] = 'new_booking';
			}
			if ($ctx['pending_action'] === 'MY_BOOKINGS') {
				$aiExtraction['intent'] = 'my_bookings';
			}
			if ($ctx['pending_action'] === 'MODIFY_BOOKING') {
				$aiExtraction['intent'] = 'modify_booking';
			}
		}

		return $aiExtraction;
	}

	private function mergeFlowContextFromAi($ctx, $ai) {
		if (!is_array($ctx)) {
			$ctx = array();
		}
		if (!is_array($ai)) {
			return $ctx;
		}

		if (!empty($ai['nombre'])) {
			$nombre = $this->normalizePersonNameCandidate($ai['nombre']);
			if (!empty($nombre)) {
				$ctx['nombre'] = $nombre;
			}
		}

		if (!empty($ai['telefono'])) {
			$telefono = $this->normalizePhoneCandidate($ai['telefono']);
			if (!empty($telefono)) {
				$ctx['telefono'] = $telefono;
			}
		}
		if (!empty($ai['dni'])) {
			$dni = strtoupper(preg_replace('/[^0-9A-Za-z]/', '', (string)$ai['dni']));
			if (preg_match('/^[0-9]{8}[A-Z]$/', $dni)) {
				$ctx['dniCompleto'] = $dni;
			}
		}
		if (!empty($ai['cp'])) {
			$cp = preg_replace('/\D+/', '', (string)$ai['cp']);
			if (strlen($cp) >= 5) {
				$ctx['cp'] = substr($cp, 0, 5);
			}
		}
		if (!empty($ai['fecha_entrada'])) {
			$ctx['fecha_entrada'] = $this->normalizeIsoDate($ai['fecha_entrada']);
		}
		if (!empty($ai['fecha_salida'])) {
			$ctx['fecha_salida'] = $this->normalizeIsoDate($ai['fecha_salida']);
		}
		if (!empty($ai['noches'])) {
			$noches = (int)$ai['noches'];
			if ($noches > 0 && $noches <= 30) {
				$ctx['noches'] = $noches;
			}
		}
		if (!empty($ai['personas'])) {
			$personas = (int)$ai['personas'];
			if ($personas > 0 && $personas <= 20) {
				$ctx['personas'] = $personas;
			}
		}

		if (!empty($ai['intent']) && $ai['intent'] === 'new_booking') {
			$ctx['pending_action'] = 'NEW_BOOKING';
		}
		if (!empty($ai['intent']) && $ai['intent'] === 'my_bookings') {
			$ctx['pending_action'] = 'MY_BOOKINGS';
		}
		if (!empty($ai['intent']) && $ai['intent'] === 'modify_booking') {
			$ctx['pending_action'] = 'MODIFY_BOOKING';
		}

		$ctx = $this->syncStayDatesFromContext($ctx);

		return $ctx;
	}

	private function syncStayDatesFromContext($ctx) {
		if (!is_array($ctx)) {
			return array();
		}

		if (empty($ctx['fecha_entrada'])) {
			return $ctx;
		}

		$fechaEntradaTs = strtotime($ctx['fecha_entrada']);
		if ($fechaEntradaTs === false) {
			return $ctx;
		}

		if (!empty($ctx['noches']) && empty($ctx['fecha_salida'])) {
			$noches = (int)$ctx['noches'];
			if ($noches > 0 && $noches <= 30) {
				$ctx['fecha_salida'] = date('Y-m-d', strtotime($ctx['fecha_entrada'] . ' +' . $noches . ' day'));
			}
		}

		if (!empty($ctx['fecha_salida'])) {
			$fechaSalidaNorm = $this->normalizeIsoDate($ctx['fecha_salida']);
			if (!empty($fechaSalidaNorm)) {
				$fechaSalidaTs = strtotime($fechaSalidaNorm);
				if ($fechaSalidaTs !== false && $fechaSalidaTs > $fechaEntradaTs) {
					$diffDays = (int)(($fechaSalidaTs - $fechaEntradaTs) / 86400);
					if ($diffDays > 0 && $diffDays <= 30) {
						$ctx['fecha_salida'] = $fechaSalidaNorm;
						$ctx['noches'] = $diffDays;
					}
				}
			}
		}

		return $ctx;
	}

	private function applyDeterministicCaptureFallback($state, $input, $ctx, $aiExtraction) {
		if (!is_array($ctx)) {
			$ctx = array();
		}
		if (!is_array($aiExtraction)) {
			$aiExtraction = array();
		}

		if (empty($ctx['nombre'])) {
			$nombre = $this->extractNameFromInputEs($input);
			if (!empty($nombre)) {
				$ctx['nombre'] = $nombre;
				$aiExtraction['nombre'] = $nombre;
				$aiExtraction['capture_ok'] = !empty($aiExtraction['capture_ok']) && $aiExtraction['capture_ok'] === 'yes' ? 'yes' : 'unknown';
				$aiExtraction['capture_field'] = !empty($aiExtraction['capture_field']) && $aiExtraction['capture_field'] !== 'none'
					? $aiExtraction['capture_field']
					: 'nombre';
				$this->log("[AI_FLOW] Nombre capturado por fallback determinista: " . $nombre, PEAR_LOG_INFO);
			}
		}

		if ($state === 'ASK_DNI' && empty($ctx['dniCompleto'])) {
			$dni = $this->normalizeDniCompleto($input);
			if (!empty($dni) && preg_match('/^[0-9]{8}[A-Z]$/', $dni)) {
				$ctx['dniCompleto'] = $dni;
				$aiExtraction['dni'] = $dni;
				$aiExtraction['capture_ok'] = 'yes';
				$aiExtraction['capture_field'] = 'dni';
				$this->log("[AI_FLOW] DNI capturado por fallback determinista: " . $dni, PEAR_LOG_INFO);
			}
		}

		$canTryPhoneCapture = ($state === 'ASK_PHONE') || $this->containsPhoneHint($input);
		if ($canTryPhoneCapture && empty($ctx['telefono'])) {
			$telefono = $this->extractPhoneFromContextEs($input);
			if (empty($telefono) && $state === 'ASK_PHONE') {
				$telefono = $this->extractPhone($input);
			}
			if (!empty($telefono)) {
				$ctx['telefono'] = $telefono;
				$aiExtraction['telefono'] = $telefono;
				if ($state === 'ASK_PHONE') {
					$aiExtraction['capture_ok'] = 'yes';
					$aiExtraction['capture_field'] = 'telefono';
				}
				$this->log("[AI_FLOW] Teléfono capturado por fallback determinista: " . $telefono, PEAR_LOG_INFO);
			}
		}

		if ($state === 'ASK_CP' && empty($ctx['cp'])) {
			$cp = $this->extractPostalCode($input);
			if (!empty($cp)) {
				$ctx['cp'] = $cp;
				$aiExtraction['cp'] = $cp;
				$aiExtraction['capture_ok'] = 'yes';
				$aiExtraction['capture_field'] = 'cp';
				$this->log("[AI_FLOW] CP capturado por fallback determinista: " . $cp, PEAR_LOG_INFO);
			}
		}

		return array(
			'ctx' => $ctx,
			'aiExtraction' => $aiExtraction
		);
	}

	private function recoverDatesAfterPeopleCorrection($state, $ctx, $aiExtraction) {
		if ($state !== 'ASK_CHECKIN' || !is_array($ctx)) {
			return $ctx;
		}

		if (!empty($ctx['fecha_entrada'])) {
			return $ctx;
		}

		if (empty($ctx['ultima_busqueda_sin_disponibilidad']) || !is_array($ctx['ultima_busqueda_sin_disponibilidad'])) {
			return $ctx;
		}

		$ultima = $ctx['ultima_busqueda_sin_disponibilidad'];
		if (empty($ultima['fecha_entrada'])) {
			return $ctx;
		}

		$peopleCorrectionDetected = false;
		if (is_array($aiExtraction)
			&& !empty($aiExtraction['capture_ok'])
			&& $aiExtraction['capture_ok'] === 'yes'
			&& !empty($aiExtraction['capture_field'])
			&& $aiExtraction['capture_field'] === 'personas') {
			$peopleCorrectionDetected = true;
		}

		if (!$peopleCorrectionDetected) {
			return $ctx;
		}

		$ctx['fecha_entrada'] = $ultima['fecha_entrada'];
		if (!empty($ultima['fecha_salida'])) {
			$ctx['fecha_salida'] = $ultima['fecha_salida'];
		}
		if (!empty($ultima['noches'])) {
			$ctx['noches'] = (int)$ultima['noches'];
		}

		$this->log("[AI_FLOW] Reutilizando fechas previas tras corrección de personas: " . json_encode($ultima), PEAR_LOG_INFO);
		return $this->syncStayDatesFromContext($ctx);
	}

	private function normalizeIsoDate($dateStr) {
		$value = trim((string)$dateStr);
		if (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $value, $m)) {
			if (checkdate((int)$m[2], (int)$m[3], (int)$m[1])) {
				return $value;
			}
		}
		if (preg_match('/^(\d{2})\/(\d{2})\/(\d{4})$/', $value, $m)) {
			if (checkdate((int)$m[2], (int)$m[1], (int)$m[3])) {
				return $m[3] . '-' . $m[2] . '-' . $m[1];
			}
		}
		return null;
	}

	private function isResetIntent($input) {
		$txt = mb_strtolower(trim((string) $input), 'UTF-8');
		return in_array($txt, array('reset', 'reiniciar', 'empezar de nuevo', 'volver a empezar'));
	}

	private function isNewBookingIntent($input) {
		$txt = mb_strtolower((string) $input, 'UTF-8');
		return preg_match('/\b(reserva|reservar|nueva reserva|crear reserva|1)\b/u', $txt);
	}

	private function isMyBookingsIntent($input) {
		$txt = mb_strtolower((string) $input, 'UTF-8');
		return preg_match('/\b(mis reservas|consultar reservas|consulta reservas|ver reservas|2)\b/u', $txt);
	}

	private function isModifyBookingIntent($input) {
		$txt = mb_strtolower((string) $input, 'UTF-8');
		return preg_match('/\b(modificar reserva|modificar una reserva|cambiar reserva|editar reserva|cambiar una reserva|modificar mis reservas|modificar)\b/u', $txt) === 1;
	}

	private function isCapabilitiesQuestion($input) {
		$txt = mb_strtolower((string)$input, 'UTF-8');
		$txt = str_replace(array('á','é','í','ó','ú','ü'), array('a','e','i','o','u','u'), $txt);

		return preg_match('/\b(en que me puedes ayudar|que puedes hacer|que opciones tengo|que puedo hacer|ayuda|dime en que me puedes ayudar|cuales son tus opciones)\b/u', $txt) === 1;
	}

	private function isOutOfScopeIntent($input, $aiExtraction = array()) {
		$txt = mb_strtolower((string)$input, 'UTF-8');
		$txt = str_replace(array('á','é','í','ó','ú','ü'), array('a','e','i','o','u','u'), $txt);

		$domainPattern = '/\b(reserva|reservar|hotel|habitacion|habitaciones|entrada|salida|noches|persona|personas|dni|telefono|codigo postal|cp|consultar|modificar|cancelar|confirmar)\b/u';
		if (preg_match($domainPattern, $txt) === 1) {
			return false;
		}

		if (is_array($aiExtraction)) {
			$hasReservationSignal = false;
			if (!empty($aiExtraction['intent']) && in_array($aiExtraction['intent'], array('new_booking', 'my_bookings', 'modify_booking'))) {
				$hasReservationSignal = true;
			}
			if (!empty($aiExtraction['capture_field']) && in_array($aiExtraction['capture_field'], array('telefono', 'dni', 'cp', 'fecha_entrada', 'fecha_salida', 'noches', 'personas', 'confirm', 'opcion'))) {
				$hasReservationSignal = true;
			}
			if ($hasReservationSignal) {
				return false;
			}
		}

		$outOfScopePattern = '/\b(partido|futbol|real madrid|barca|liga|champions|tiempo|meteorologia|noticias|politica|bolsa|criptomonedas|receta|cocina|musica|pelicula|serie|chiste|traduce|traduccion|wikipedia|quien gano|como quedo|resultado)\b/u';
		if (preg_match($outOfScopePattern, $txt) === 1) {
			return true;
		}

		$questionPattern = '/\b(que|quien|cuando|donde|por que|porque|como)\b/u';
		if (preg_match($questionPattern, $txt) === 1 && preg_match($domainPattern, $txt) !== 1) {
			return true;
		}

		return false;
	}

	private function isEndIntent($input) {
		$txt = mb_strtolower((string) $input, 'UTF-8');
		return preg_match('/\b(salir|terminar|finalizar|adios|adiós|colgar|fin|finalizar la llamada|terminar la llamada)\b/u', $txt);
	}

	private function isTransferIntent($input) {
		$txt = mb_strtolower((string) $input, 'UTF-8');
		return preg_match('/\b(agente|persona|humano|humana|operador|operadora|recepcion|recepciÃ³n|recepcionista|persona real|persona fisica|persona fÃ­sica|persona de verdad|alguien real|hablar con alguien|hablar con una persona|hablar con recepcion|hablar con recepciÃ³n|pasame con una persona|pÃ¡same con una persona|pasame con alguien|pÃ¡same con alguien)\b/u', $txt) === 1;
	}

	private function isNoMoreIntent($input) {
		$txt = mb_strtolower((string)$input, 'UTF-8');
		return preg_match('/(no\s+quiero\s+nada\s+mas|no\s+quiero\s+nada\s+m[aá]s|nada\s+m[aá]s|eso\s+es\s+todo|no\s+necesito\s+nada\s+m[aá]s|no\s+gracias)/u', $txt) === 1;
	}

	private function isTransferToPersonIntent($input) {
		$txt = mb_strtolower((string)$input, 'UTF-8');
		return preg_match('/\b(agente|persona|humano|humana|operador|operadora|recepcion|recepcionista|persona real|persona fisica|persona de verdad|alguien real|hablar con alguien|hablar con una persona|hablar con recepcion|pasame con una persona|pasame con alguien)\b/u', $txt) === 1;
	}

	private function isYesIntent($input) {
		$txt = mb_strtolower(trim((string) $input), 'UTF-8');
		return in_array($txt, array('si', 'sí', '1', 'confirmar', 'ok', 'vale', 'de acuerdo'));
	}

	private function isNoIntent($input) {
		$txt = mb_strtolower(trim((string) $input), 'UTF-8');
		return in_array($txt, array('no', '2', 'otra', 'otras', 'mas opciones', 'más opciones'));
	}

	private function extractNameFromInputEs($input) {
		$txt = trim((string)$input);
		if ($txt === '') {
			return null;
		}

		if (preg_match('/\b(?:me\s+llamo|soy|mi\s+nombre\s+es)\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{2,}(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{2,}){0,2})/u', $txt, $m)) {
			return $this->normalizePersonNameCandidate($m[1]);
		}

		return null;
	}

	private function normalizePersonNameCandidate($rawName) {
		$name = trim((string)$rawName);
		$name = preg_replace('/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]/u', '', $name);
		$name = preg_replace('/\s+/', ' ', $name);
		$name = trim($name);
		if ($name === '' || mb_strlen($name, 'UTF-8') < 2) {
			return null;
		}

		$parts = explode(' ', mb_strtolower($name, 'UTF-8'));
		$parts = array_slice($parts, 0, 3);
		$parts = array_map(function ($part) {
			return mb_convert_case($part, MB_CASE_TITLE, 'UTF-8');
		}, $parts);

		return implode(' ', $parts);
	}

	private function extractPhone($input) {
		$digits = $this->extractDigitsFromSpeechEs($input);
		return $this->normalizePhoneCandidate($digits);
	}

	private function normalizePhoneCandidate($rawPhone) {
		$digits = preg_replace('/\D+/', '', (string)$rawPhone);
		if ($digits === '') {
			return null;
		}

		if (strlen($digits) === 11 && substr($digits, 0, 2) === '34') {
			$digits = substr($digits, 2);
		}

		if (strlen($digits) === 9 && preg_match('/^[5-9][0-9]{8}$/', $digits)) {
			return $digits;
		}

		if (strlen($digits) === 10) {
			$candidateA = substr($digits, 0, 9);
			$candidateB = substr($digits, 1, 9);

			if (preg_match('/^[5-9][0-9]{8}$/', $candidateB) && !preg_match('/^[5-9]/', substr($digits, 0, 1))) {
				return $candidateB;
			}
			if (preg_match('/^[5-9][0-9]{8}$/', $candidateA)) {
				return $candidateA;
			}
			if (preg_match('/^[5-9][0-9]{8}$/', $candidateB)) {
				return $candidateB;
			}
		}

		return null;
	}

	private function containsPhoneHint($input) {
		$txt = mb_strtolower((string)$input, 'UTF-8');
		return preg_match('/\b(telefono|teléfono|movil|móvil|numero|número)\b/u', $txt) === 1;
	}

	private function extractPhoneFromContextEs($input) {
		$txt = mb_strtolower((string)$input, 'UTF-8');
		$txt = str_replace(array('á','é','í','ó','ú','ü'), array('a','e','i','o','u','u'), $txt);

		$patterns = array(
			'/\b(?:mi\s+)?(?:numero\s+de\s+telefono|telefono|movil)\s*(?:es|:)?\s*(.+)$/u',
			'/\b(?:telefono|movil)\s*(.+)$/u'
		);

		foreach ($patterns as $pattern) {
			if (preg_match($pattern, $txt, $m)) {
				$candidate = $this->extractDigitsFromSpeechEs($m[1]);
				$phone = $this->normalizePhoneCandidate($candidate);
				if (!empty($phone)) {
					return $phone;
				}
			}
		}

		return null;
	}

	private function normalizeDniCompleto($input) {
		$value = strtoupper(preg_replace('/[^0-9A-Za-z]/', '', (string) $input));

		if (preg_match('/^[0-9]{8}[A-Z]$/', $value)) {
			return $value;
		}

		$spokenDni = $this->extractDniFromSpeechEs($input);
		if (!empty($spokenDni)) {
			return $spokenDni;
		}

		if (preg_match('/^[0-9]{7,8}$/', $value)) {
			$dniNum = (int) $value;
			return $this->completeDNI($dniNum) . $this->letraNIF($dniNum);
		}

		return null;
	}

	private function extractPostalCode($input) {
		$digits = $this->extractDigitsFromSpeechEs($input);
		if (strlen($digits) >= 5) {
			return substr($digits, 0, 5);
		}
		return null;
	}

	private function parseDateToSql($input) {
		$txt = trim((string) $input);

		if (preg_match('/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/', $txt, $m)) {
			$dia = $m[1];
			$mes = $m[2];
			$anio = $m[3];
			if (checkdate((int) $mes, (int) $dia, (int) $anio)) {
				return $anio . '-' . $mes . '-' . $dia;
			}
		}

		if (preg_match('/^(\d{8})$/', $txt)) {
			$dia = substr($txt, 0, 2);
			$mes = substr($txt, 2, 2);
			$anio = substr($txt, 4, 4);
			if (checkdate((int) $mes, (int) $dia, (int) $anio)) {
				return $anio . '-' . $mes . '-' . $dia;
			}
		}

		return null;
	}

	private function extractPeople($input) {
		$normalized = $this->extractDigitsFromSpeechEs($input);
		if (preg_match('/(\d+)/', $normalized, $m)) {
			$num = (int) $m[1];
			if ($num > 0 && $num <= 20) {
				return $num;
			}
		}
		return null;
	}

	private function extractDigitsFromSpeechEs($input) {
		$txt = mb_strtolower((string) $input, 'UTF-8');
		$txt = str_replace(array('á','é','í','ó','ú','ü'), array('a','e','i','o','u','u'), $txt);
		$txt = preg_replace('/[^a-z0-9\s]/', ' ', $txt);
		$tokens = preg_split('/\s+/', trim($txt));

		$map = array(
			'cero' => '0', 'zero' => '0',
			'un' => '1', 'uno' => '1', 'una' => '1',
			'dos' => '2',
			'tres' => '3',
			'cuatro' => '4',
			'cinco' => '5',
			'seis' => '6',
			'siete' => '7',
			'ocho' => '8',
			'nueve' => '9'
		);

		$out = '';
		foreach ($tokens as $token) {
			if ($token === '') {
				continue;
			}

			if (isset($map[$token])) {
				$out .= $map[$token];
				continue;
			}

			$onlyDigits = preg_replace('/\D+/', '', $token);
			if ($onlyDigits !== '') {
				$out .= $onlyDigits;
			}
		}

		return $out;
	}

	private function extractDniFromSpeechEs($input) {
		$txt = mb_strtolower((string) $input, 'UTF-8');
		$txt = str_replace(array('á','é','í','ó','ú','ü'), array('a','e','i','o','u','u'), $txt);
		$txt = preg_replace('/[^a-z0-9\s]/', ' ', $txt);
		$tokens = preg_split('/\s+/', trim($txt));

		$digitMap = array(
			'cero' => '0', 'zero' => '0',
			'un' => '1', 'uno' => '1', 'una' => '1',
			'dos' => '2', 'tres' => '3', 'cuatro' => '4', 'cinco' => '5',
			'seis' => '6', 'siete' => '7', 'ocho' => '8', 'nueve' => '9'
		);

		$letterMap = array(
			'a' => 'A', 'be' => 'B', 'b' => 'B', 'ce' => 'C', 'c' => 'C',
			'de' => 'D', 'd' => 'D', 'e' => 'E', 'efe' => 'F', 'f' => 'F',
			'ge' => 'G', 'g' => 'G', 'hache' => 'H', 'h' => 'H', 'i' => 'I',
			'jota' => 'J', 'j' => 'J', 'ka' => 'K', 'k' => 'K', 'ele' => 'L',
			'l' => 'L', 'eme' => 'M', 'm' => 'M', 'ene' => 'N', 'n' => 'N',
			'o' => 'O', 'pe' => 'P', 'p' => 'P', 'cu' => 'Q', 'q' => 'Q',
			'erre' => 'R', 'r' => 'R', 'ese' => 'S', 's' => 'S', 'te' => 'T',
			't' => 'T', 'u' => 'U', 'uve' => 'V', 'v' => 'V', 'dobleuve' => 'W',
			'w' => 'W', 'equis' => 'X', 'x' => 'X', 'ye' => 'Y', 'y' => 'Y',
			'z' => 'Z', 'zeta' => 'Z', 'zed' => 'Z'
		);

		$digits = '';
		$letter = '';

		foreach ($tokens as $token) {
			if ($token === '') {
				continue;
			}

			if (isset($digitMap[$token])) {
				$digits .= $digitMap[$token];
				continue;
			}

			if (ctype_digit($token)) {
				$digits .= $token;
				continue;
			}

			if (isset($letterMap[$token])) {
				$letter = $letterMap[$token];
				continue;
			}
		}

		if (strlen($digits) < 7 || strlen($digits) > 8) {
			return null;
		}

		$dniNumPadded = $this->completeDNI((int) $digits);
		if (empty($letter)) {
			$letter = $this->letraNIF((int) $dniNumPadded);
		}

		return $dniNumPadded . strtoupper($letter);
	}

	private function findUserByDniAndPhone($dniCompleto, $telefono) {
		try {
			return Doctrine_Query::create()
				->select('id_usuario')
				->from('CvrUserProyect')
				->where('documento_identidad = ?', trim($dniCompleto))
				->andWhere('telefono = ?', trim($telefono))
				->fetchOne(array(), Doctrine_Core::HYDRATE_ARRAY);
		} catch (Exception $e) {
			$this->log("[AI_FLOW] Error buscando usuario: " . $e->getMessage(), PEAR_LOG_ERR);
			return null;
		}
	}

	private function findUserByPhoneOrDni($telefono, $dniCompleto) {
		$telefono = trim((string)$telefono);
		$dniCompleto = trim((string)$dniCompleto);

		if ($telefono === '' && $dniCompleto === '') {
			return null;
		}

		try {
			$q = Doctrine_Query::create()
				->select('id_usuario, documento_identidad, telefono')
				->from('CvrUserProyect');

			if ($telefono !== '' && $dniCompleto !== '') {
				$q->where('telefono = ?', $telefono)
				  ->orWhere('documento_identidad = ?', $dniCompleto);
			} elseif ($telefono !== '') {
				$q->where('telefono = ?', $telefono);
			} else {
				$q->where('documento_identidad = ?', $dniCompleto);
			}

			return $q->fetchOne(array(), Doctrine_Core::HYDRATE_ARRAY);
		} catch (Exception $e) {
			$this->log("[AI_FLOW] Error buscando usuario por teléfono o DNI: " . $e->getMessage(), PEAR_LOG_ERR);
			return null;
		}
	}

	private function createUserFromContext($ctx) {
		try {
			$existingUser = $this->findUserByPhoneOrDni(
				isset($ctx['telefono']) ? $ctx['telefono'] : '',
				isset($ctx['dniCompleto']) ? $ctx['dniCompleto'] : ''
			);

			if (!empty($existingUser) && !empty($existingUser['id_usuario'])) {
				$this->log("[AI_FLOW] Usuario ya existente, se evita INSERT. id_usuario=" . $existingUser['id_usuario'], PEAR_LOG_INFO);
				return $existingUser['id_usuario'];
			}

			$insert = new CvrUserProyect();
			$insert->cp = $ctx['cp'];
			$insert->documento_identidad = $ctx['dniCompleto'];
			$insert->telefono = $ctx['telefono'];
			$insert->fecha_creacion = date('Y-m-d H:i:s');
			$insert->save();
			return $insert->id_usuario;
		} catch (Exception $e) {
			$this->log("[AI_FLOW] Error creando usuario: " . $e->getMessage(), PEAR_LOG_ERR);
			return null;
		}
	}

	private function checkAvailabilityForFlow($fechaEntradaSQL, $fechaSalidaSQL, $personas) {
		try {
			$habitacionesOcupadas = Doctrine_Query::create()
				->select('r.id_habitacion')
				->from('CvrUserProyectR r')
				->where('r.fecha_entrada < ?', $fechaSalidaSQL)
				->andWhere('r.fecha_salida > ?', $fechaEntradaSQL)
				->execute(array(), Doctrine_Core::HYDRATE_ARRAY);

			$ocupadasIds = array_column($habitacionesOcupadas, 'id_habitacion');

			$q = Doctrine_Query::create()
				->from('CvrUserProyectH h')
				->where('h.capacidad >= ?', $personas);

			if (!empty($ocupadasIds)) {
				$q->andWhereNotIn('h.id_habitacion', $ocupadasIds);
			}

			$rooms = $q->execute(array(), Doctrine_Core::HYDRATE_ARRAY);

			$fechaEntrada = new DateTime($fechaEntradaSQL);
			$fechaSalida = new DateTime($fechaSalidaSQL);
			$diasEstancia = $fechaEntrada->diff($fechaSalida)->days;

			return array(
				'rooms' => $rooms,
				'dias' => $diasEstancia
			);
		} catch (Exception $e) {
			$this->log("[AI_FLOW] Error consultando disponibilidad: " . $e->getMessage(), PEAR_LOG_ERR);
			return null;
		}
	}

	private function createReservationFromArray($reserva) {
		if (empty($reserva) || !is_array($reserva)) {
			return false;
		}

		try {
			$insert = new CvrUserProyectR();
			$insert->id_usuario = $reserva['id_usuario'];
			$insert->id_habitacion = $reserva['id_habitacion'];
			$insert->fecha_entrada = $reserva['fecha_entrada'];
			$insert->fecha_salida = $reserva['fecha_salida'];
			$insert->numero_personas = $reserva['numero_personas'];
			$insert->save();
			return true;
		} catch (Exception $e) {
			$this->log("[AI_FLOW] Error creando reserva: " . $e->getMessage(), PEAR_LOG_ERR);
			return false;
		}
	}

	private function buildFutureBookingsOptionsForModification($idUsuario) {
		try {
			$hoy = date('Y-m-d');
			$reservas = Doctrine_Query::create()
				->select('r.id_habitacion, r.fecha_entrada, r.fecha_salida, r.numero_personas, h.descripcion, h.precio_noche')
				->from('CvrUserProyectR r')
				->leftJoin('r.CvrUserProyectH h')
				->where('r.id_usuario = ?', $idUsuario)
				->andWhere('r.fecha_entrada >= ?', $hoy)
				->orderBy('r.fecha_entrada ASC')
				->execute(array(), Doctrine_Core::HYDRATE_ARRAY);

			if (empty($reservas)) {
				return array(
					'message' => 'No tienes reservas futuras para modificar. ¿Desea realizar alguna otra gestión?',
					'options' => array()
				);
			}

			$options = array();
			$parts = array();
			$total = count($reservas);
			foreach ($reservas as $idx => $reserva) {
				$op = $idx + 1;
				$options[$op] = array(
					'id_usuario' => $idUsuario,
					'id_habitacion' => $reserva['id_habitacion'],
					'fecha_entrada' => $reserva['fecha_entrada'],
					'fecha_salida' => $reserva['fecha_salida'],
					'numero_personas' => $reserva['numero_personas']
				);

				$descripcion = $this->extractRoomFieldFromBooking($reserva, 'descripcion', null);
				$precioNocheRaw = $this->extractRoomFieldFromBooking($reserva, 'precio_noche', null);

				if (($descripcion === null || $descripcion === '') || $precioNocheRaw === null) {
					$idHabitacion = isset($reserva['id_habitacion']) ? (int)$reserva['id_habitacion'] : 0;
					if ($idHabitacion > 0) {
						$roomData = $this->getRoomDataById($idHabitacion);
						if (($descripcion === null || $descripcion === '') && !empty($roomData['descripcion'])) {
							$descripcion = $roomData['descripcion'];
						}
						if ($precioNocheRaw === null && isset($roomData['precio_noche'])) {
							$precioNocheRaw = $roomData['precio_noche'];
						}
					}
				}

				if ($descripcion === null || $descripcion === '') {
					$descripcion = 'habitación sin descripción';
				}

				$precioNoche = $precioNocheRaw !== null ? (float)$precioNocheRaw : null;
				$noches = null;
				if (!empty($reserva['fecha_entrada']) && !empty($reserva['fecha_salida'])) {
					$fe = new DateTime($reserva['fecha_entrada']);
					$fs = new DateTime($reserva['fecha_salida']);
					$noches = $fe->diff($fs)->days;
				}
				$precioFinal = ($precioNoche !== null && $noches !== null) ? ($precioNoche * $noches) : null;

				$descripcion = $this->normalizeRoomDescriptionForSpeech($descripcion);
				$entrada = $this->formatDateForSpeech($reserva['fecha_entrada']);
				$salida = $this->formatDateForSpeech($reserva['fecha_salida']);
				$personas = (int)$reserva['numero_personas'];
				$personasTxt = $personas === 1 ? '1 persona' : ($personas . ' personas');

				$texto = ($total === 1 ? '' : ('Opción ' . $op . ': ')) . $descripcion
					. ', para ' . $personasTxt
					. ', del ' . $entrada . ' al ' . $salida;
				if ($precioFinal !== null) {
					$texto .= ', precio final ' . number_format($precioFinal, 0, ',', '.') . ' euros';
				}
				$parts[] = $texto;
			}

			if ($total === 1) {
				return array(
					'message' => 'Tienes 1 reserva futura para modificar. ' . $parts[0] . '. ¿Es esta la reserva que desea modificar? Responda sí o no.',
					'options' => $options,
					'single' => true,
					'selected' => $options[1]
				);
			}

			return array(
				'message' => 'Estas son tus reservas futuras para modificar. ' . implode('. ', $parts) . '. Indíqueme el número de la opción que desea modificar.',
				'options' => $options,
				'single' => false,
				'selected' => null
			);
		} catch (Exception $e) {
			$this->log('[AI_FLOW] Error preparando opciones de modificación: ' . $e->getMessage(), PEAR_LOG_ERR);
			return array(
				'message' => 'No he podido consultar tus reservas para modificarlas en este momento. ¿Desea realizar alguna otra gestión?',
				'options' => array(),
				'single' => false,
				'selected' => null
			);
		}
	}

	private function detectReservationFieldToModify($input) {
		$txt = mb_strtolower((string)$input, 'UTF-8');
		$txt = str_replace(array('á','é','í','ó','ú','ü'), array('a','e','i','o','u','u'), $txt);

		if (preg_match('/fecha\s+de\s+entrada|entrada|checkin|check in/u', $txt)) {
			return 'fecha_entrada';
		}
		if (preg_match('/fecha\s+de\s+salida|salida|checkout|check out|noches?/u', $txt)) {
			return 'fecha_salida';
		}
		if (preg_match('/personas?|huespedes?|hu[eé]spedes?/u', $txt)) {
			return 'numero_personas';
		}

		return null;
	}

	private function replaceReservationByData($oldReservation, $newReservation) {
		if (empty($oldReservation) || !is_array($oldReservation) || empty($newReservation) || !is_array($newReservation)) {
			return false;
		}

		try {
			$record = Doctrine_Query::create()
				->from('CvrUserProyectR r')
				->where('r.id_usuario = ?', $oldReservation['id_usuario'])
				->andWhere('r.id_habitacion = ?', $oldReservation['id_habitacion'])
				->andWhere('r.fecha_entrada = ?', $oldReservation['fecha_entrada'])
				->andWhere('r.fecha_salida = ?', $oldReservation['fecha_salida'])
				->andWhere('r.numero_personas = ?', $oldReservation['numero_personas'])
				->fetchOne();

			if (!$record) {
				$this->log('[AI_FLOW] No se encontró la reserva original para reemplazar.', PEAR_LOG_ERR);
				return false;
			}

			$record->delete();
			if ($this->createReservationFromArray($newReservation)) {
				return true;
			}

			$this->createReservationFromArray($oldReservation);
			return false;
		} catch (Exception $e) {
			$this->log('[AI_FLOW] Error reemplazando reserva: ' . $e->getMessage(), PEAR_LOG_ERR);
			return false;
		}
	}

	private function buildUserBookingsSummary($idUsuario) {
		try {
			$hoy = date('Y-m-d');
			$reservas = Doctrine_Query::create()
				->select('r.id_habitacion, r.fecha_entrada, r.fecha_salida, r.numero_personas, h.descripcion, h.precio_noche')
				->from('CvrUserProyectR r')
				->leftJoin('r.CvrUserProyectH h')
				->where('r.id_usuario = ?', $idUsuario)
				->andWhere('r.fecha_entrada >= ?', $hoy)
				->orderBy('r.fecha_entrada ASC')
				->execute(array(), Doctrine_Core::HYDRATE_ARRAY);

			if (empty($reservas)) {
				return "No tienes reservas futuras registradas. Si quieres, puedo ayudarte a crear una nueva reserva.";
			}

			$totalReservas = count($reservas);
			$msg = $totalReservas === 1
				? "Tienes 1 reserva futura. "
				: "Tienes " . $totalReservas . " reservas futuras. Te las indico de forma ordenada. ";
			foreach ($reservas as $idx => $reserva) {
				$descripcion = $this->extractRoomFieldFromBooking($reserva, 'descripcion', null);
				$precioNocheRaw = $this->extractRoomFieldFromBooking($reserva, 'precio_noche', null);

				if (($descripcion === null || $descripcion === '') || $precioNocheRaw === null) {
					$idHabitacion = isset($reserva['id_habitacion']) ? (int)$reserva['id_habitacion'] : 0;
					if ($idHabitacion > 0) {
						$roomData = $this->getRoomDataById($idHabitacion);
						if (($descripcion === null || $descripcion === '') && !empty($roomData['descripcion'])) {
							$descripcion = $roomData['descripcion'];
						}
						if ($precioNocheRaw === null && isset($roomData['precio_noche'])) {
							$precioNocheRaw = $roomData['precio_noche'];
						}
					}
				}

				if ($descripcion === null || $descripcion === '') {
					$descripcion = 'habitación sin descripción';
				}

				$descripcionLocucion = $this->normalizeRoomDescriptionForSpeech($descripcion);
				$precioNoche = $precioNocheRaw !== null ? (float)$precioNocheRaw : null;

				$noches = null;
				if (!empty($reserva['fecha_entrada']) && !empty($reserva['fecha_salida'])) {
					$fechaEntrada = new DateTime($reserva['fecha_entrada']);
					$fechaSalida = new DateTime($reserva['fecha_salida']);
					$noches = $fechaEntrada->diff($fechaSalida)->days;
				}

				$precioFinal = ($precioNoche !== null && $noches !== null) ? ($precioNoche * $noches) : null;

				$fechaEntradaTxt = $this->formatDateForSpeech($reserva['fecha_entrada']);
				$fechaSalidaTxt = $this->formatDateForSpeech($reserva['fecha_salida']);
				$personasTxt = (int)$reserva['numero_personas'] === 1 ? '1 persona' : ((int)$reserva['numero_personas'] . ' personas');

				if ($totalReservas === 1) {
					$msg .= $descripcionLocucion
						. ", para " . $personasTxt
						. ", del " . $fechaEntradaTxt
						. " al " . $fechaSalidaTxt;
				} else {
					$msg .= "Opción " . ($idx + 1) . ": " . $descripcionLocucion
						. ", para " . $personasTxt
						. ", del " . $fechaEntradaTxt
						. " al " . $fechaSalidaTxt;
				}

				if ($precioFinal !== null) {
					$msg .= ", precio final " . number_format($precioFinal, 0, ',', '.') . " euros";
				} else {
					$msg .= ", precio final no disponible";
				}
				$msg .= ". ";
			}

			if ($totalReservas === 1) {
				$msg .= " ¿Desea realizar alguna otra gestión?";
			} else {
				$msg .= "Eso es todo. ¿Desea realizar alguna otra gestión?";
			}
			return $msg;
		} catch (Exception $e) {
			$this->log("[AI_FLOW] Error consultando reservas del usuario: " . $e->getMessage(), PEAR_LOG_ERR);
			return "No he podido consultar tus reservas en este momento. ¿Quieres que intentemos una nueva reserva?";
		}
	}

	private function getRoomDataById($idHabitacion) {
		try {
			if (empty($idHabitacion)) {
				return array();
			}

			$room = Doctrine_Query::create()
				->select('h.descripcion, h.precio_noche')
				->from('CvrUserProyectH h')
				->where('h.id_habitacion = ?', $idHabitacion)
				->fetchOne(array(), Doctrine_Core::HYDRATE_ARRAY);

			return is_array($room) ? $room : array();
		} catch (Exception $e) {
			$this->log("[AI_FLOW] Error consultando datos de habitacion por id " . $idHabitacion . ": " . $e->getMessage(), PEAR_LOG_ERR);
			return array();
		}
	}

	private function formatDateForSpeech($dateValue) {
		$dateValue = trim((string)$dateValue);
		if ($dateValue === '') {
			return 'fecha no disponible';
		}

		$ts = strtotime($dateValue);
		if ($ts === false) {
			return $dateValue;
		}

		return date('d/m/Y', $ts);
	}

	private function normalizeRoomDescriptionForSpeech($descripcion) {
		$texto = trim((string)$descripcion);
		if ($texto === '') {
			return 'Habitación sin descripción';
		}

		$textoLimpio = strtolower($texto);
		if (strpos($textoLimpio, 'habitacion') === 0 || strpos($textoLimpio, 'habitación') === 0) {
			return $texto;
		}

		return 'Habitación ' . $texto;
	}

	private function extractRoomFieldFromBooking($reserva, $field, $defaultValue = null) {
		if (!is_array($reserva)) {
			return $defaultValue;
		}

		if (array_key_exists($field, $reserva) && $reserva[$field] !== null && $reserva[$field] !== '') {
			return $reserva[$field];
		}

		if (isset($reserva['h']) && is_array($reserva['h']) && array_key_exists($field, $reserva['h']) && $reserva['h'][$field] !== null && $reserva['h'][$field] !== '') {
			return $reserva['h'][$field];
		}

		if (isset($reserva['CvrUserProyectH']) && is_array($reserva['CvrUserProyectH']) && array_key_exists($field, $reserva['CvrUserProyectH']) && $reserva['CvrUserProyectH'][$field] !== null && $reserva['CvrUserProyectH'][$field] !== '') {
			return $reserva['CvrUserProyectH'][$field];
		}

		return $defaultValue;
	}

	private function callGeminiApi($payload, $apiKey, $model, $logPrefix) {
		$url = "https://generativelanguage.googleapis.com/v1beta/models/"
			. $model . ":generateContent?key=" . urlencode($apiKey);

		$requestStartedAt = microtime(true);
		$this->log("[" . $logPrefix . "] INICIO peticion IA | model=" . $model . " | url=" . $url, PEAR_LOG_INFO);

		$ch = curl_init($url);
		curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
		curl_setopt($ch, CURLOPT_TIMEOUT, 30);
		curl_setopt($ch, CURLOPT_HTTPHEADER, array(
			"Content-Type: application/json"
		));
		curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));

		$response = curl_exec($ch);
		$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
		$curlError = curl_error($ch);
		$elapsedSeconds = round(microtime(true) - $requestStartedAt, 3);
		curl_close($ch);

		$this->log("[" . $logPrefix . "] FIN peticion IA | model=" . $model . " | http_code=" . $httpCode, PEAR_LOG_INFO);
		$this->log("[" . $logPrefix . "] TIEMPO RESPUESTA IA | model=" . $model . " | segundos=" . $elapsedSeconds, PEAR_LOG_INFO);

		return array(
			'response' => $response,
			'httpCode' => $httpCode,
			'curlError' => $curlError,
			'elapsedSeconds' => $elapsedSeconds
		);
	}

	private function decodeJsonObjectLenient($content) {
		$raw = trim((string)$content);
		$decoded = json_decode($raw, true);
		if (is_array($decoded)) {
			return $decoded;
		}

		$clean = preg_replace('/^```(?:json)?\s*/i', '', $raw);
		$clean = preg_replace('/\s*```$/', '', $clean);
		$clean = trim($clean);

		$decoded = json_decode($clean, true);
		if (is_array($decoded)) {
			return $decoded;
		}

		return null;
	}

	private function getExternalFlowFilePath($externalSessionId) {
		$safeId = md5((string)$externalSessionId);
		return rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'monteluz_flow_' . $safeId . '.json';
	}

	private function restoreFlowContextByExternalSession($externalSessionId) {
		$path = $this->getExternalFlowFilePath($externalSessionId);
		if (!file_exists($path)) {
			$this->log("[AI_FLOW] No existe estado persistido para session_id: " . $externalSessionId, PEAR_LOG_INFO);
			return;
		}

		$content = @file_get_contents($path);
		if ($content === false) {
			$this->log("[AI_FLOW] No se pudo leer estado persistido: " . $path, PEAR_LOG_WARNING);
			return;
		}

		$data = json_decode($content, true);
		if (!is_array($data)) {
			$this->log("[AI_FLOW] Estado persistido inválido para session_id: " . $externalSessionId, PEAR_LOG_WARNING);
			return;
		}

		$keys = array('ai_flow_state', 'ai_flow_ctx', 'ai_flow_recent_replies', 'result', 'reservaPrevia', 'reservaFinal', 'reserva_modificar_opciones', 'reserva_modificar_original', 'idUsuario', 'dniCompleto', 'telefono', 'current_confid');
		foreach ($keys as $key) {
			if (array_key_exists($key, $data)) {
				$this->session->set_data($key, $data[$key]);
			}
		}

		$this->log("[AI_FLOW] Estado restaurado para session_id: " . $externalSessionId . " | Estado=" . (isset($data['ai_flow_state']) ? $data['ai_flow_state'] : 'N/A'), PEAR_LOG_INFO);
	}

	private function persistFlowContextByExternalSession($externalSessionId) {
		$path = $this->getExternalFlowFilePath($externalSessionId);
		$keys = array('ai_flow_state', 'ai_flow_ctx', 'ai_flow_recent_replies', 'result', 'reservaPrevia', 'reservaFinal', 'reserva_modificar_opciones', 'reserva_modificar_original', 'idUsuario', 'dniCompleto', 'telefono', 'current_confid');
		$payload = array();

		foreach ($keys as $key) {
			$payload[$key] = $this->session->get_data($key);
		}

		$payload['updated_at'] = date('Y-m-d H:i:s');

		$ok = @file_put_contents($path, json_encode($payload));
		if ($ok === false) {
			$this->log("[AI_FLOW] No se pudo persistir estado en: " . $path, PEAR_LOG_ERR);
			return;
		}

		$this->log("[AI_FLOW] Estado persistido para session_id: " . $externalSessionId . " | Estado=" . $payload['ai_flow_state'], PEAR_LOG_INFO);
	}

	private function saveAiExtractionByConfid($aiExtraction) {
		$confid = $this->resolveCurrentConfid();
		if ($confid === '') {
			$this->log("[AI_FLOW] No se pudo guardar json_info porque no hay confid disponible.", PEAR_LOG_WARNING);
			return;
		}

		$aiExtraction = $this->mergeAiExtractionKeepingPrevious($aiExtraction);

		$jsonInfo = json_encode($aiExtraction, JSON_UNESCAPED_UNICODE);
		if ($jsonInfo === false) {
			$jsonInfo = '{}';
		}

		try {
			$record = Doctrine_Query::create()
				->from('CvrUserInfoCall c')
				->where('c.confid = ?', $confid)
				->fetchOne();

			if ($record) {
				$record->json_info = $jsonInfo;
				$record->type = 'update';
				$record->save();
				$this->log("[AI_FLOW] Actualizado json_info en cvr_user_info_call para confid: " . $confid, PEAR_LOG_INFO);
				return;
			}

			$insert = new CvrUserInfoCall();
			$insert->confid = $confid;
			$insert->json_info = $jsonInfo;
			$insert->type = 'new';
			$insert->save();

			$this->log("[AI_FLOW] Insertado json_info en cvr_user_info_call para confid: " . $confid, PEAR_LOG_INFO);
		} catch (Exception $e) {
			$this->log("[AI_FLOW] Error guardando json_info en cvr_user_info_call para confid " . $confid . ": " . $e->getMessage(), PEAR_LOG_ERR);
		}
	}

	private function mergeAiExtractionKeepingPrevious($currentExtraction, $ctx = array()) {
		if (!is_array($currentExtraction)) {
			$currentExtraction = array();
		}

		$defaults = $this->getAiExtractionDefaults();

		$previousExtraction = $this->session->get_data('ai_last_extraction');
		if (!is_array($previousExtraction)) {
			$previousExtraction = $this->loadAiExtractionByConfid();
		}
		if (!is_array($previousExtraction)) {
			$previousExtraction = array();
		}

		$merged = array_merge($defaults, $previousExtraction);
		foreach ($currentExtraction as $key => $value) {
			$merged[$key] = $value;
		}

		if (is_array($ctx)) {
			if (array_key_exists('nombre', $ctx)) {
				$merged['nombre'] = $ctx['nombre'];
			}
			if (array_key_exists('telefono', $ctx)) {
				$merged['telefono'] = $ctx['telefono'];
			}
			if (array_key_exists('dniCompleto', $ctx)) {
				$merged['dni'] = $ctx['dniCompleto'];
			}
			if (array_key_exists('cp', $ctx)) {
				$merged['cp'] = $ctx['cp'];
			}
			if (array_key_exists('fecha_entrada', $ctx)) {
				$merged['fecha_entrada'] = $ctx['fecha_entrada'];
			}
			if (array_key_exists('fecha_salida', $ctx)) {
				$merged['fecha_salida'] = $ctx['fecha_salida'];
			}
			if (array_key_exists('noches', $ctx)) {
				$merged['noches'] = $ctx['noches'] !== null ? (int)$ctx['noches'] : null;
			}
			if (array_key_exists('personas', $ctx)) {
				$merged['personas'] = $ctx['personas'] !== null ? (int)$ctx['personas'] : null;
			}
		}

		foreach ($defaults as $key => $defaultValue) {
			if (!array_key_exists($key, $merged)) {
				$merged[$key] = $defaultValue;
			}
		}

		return $merged;
	}

	private function getAiExtractionDefaults() {
		return array(
			'intent' => 'unknown',
			'nombre' => null,
			'telefono' => null,
			'dni' => null,
			'cp' => null,
			'fecha_entrada' => null,
			'fecha_salida' => null,
			'noches' => null,
			'personas' => null,
			'confirm' => 'unknown',
			'opcion' => null,
			'capture_ok' => 'unknown',
			'capture_field' => 'none',
			'end' => 'no',
			'reset' => 'no'
		);
	}

	private function loadAiExtractionByConfid() {
		$confid = $this->resolveCurrentConfid();
		if ($confid === '') {
			return array();
		}

		try {
			$record = Doctrine_Query::create()
				->select('c.json_info')
				->from('CvrUserInfoCall c')
				->where('c.confid = ?', $confid)
				->fetchOne(array(), Doctrine_Core::HYDRATE_ARRAY);

			if (empty($record) || empty($record['json_info'])) {
				return array();
			}

			$decoded = json_decode($record['json_info'], true);
			return is_array($decoded) ? $decoded : array();
		} catch (Exception $e) {
			$this->log("[AI_FLOW] Error leyendo json_info previo para confid " . $confid . ": " . $e->getMessage(), PEAR_LOG_ERR);
			return array();
		}
	}

	private function resolveCurrentConfid() {
		$confid = $this->session->get_data('current_confid');
		if (!empty($confid)) {
			return $this->normalizeConfid($confid);
		}

		return '';
	}

	private function normalizeConfid($value) {
		$confid = trim((string) $value);
		if ($confid === '') {
			return '';
		}

		if (stripos($confid, 'V-') === 0) {
			$confid = substr($confid, 2);
		}

		return trim((string) $confid);
	}


    private function get_history_params() {
        $params = array();
        foreach ($_REQUEST as $key => $value) {
            if (preg_match("/^node_history/", $key)) {
                $params[] = $value;
            }
        }
        return $params;
    }



	private function completeDNI ($dni){
		$zeros = 8 - strlen((string)$dni);
		
		for($i=0; $i < $zeros; $i++){
			$dni = '0'.$dni;
		}
		
		return $dni;
	}
	
	
	private function letraNIF ($dni) {
		/* Obtiene letra del NIF a partir del DNI */
		$valor= (int) ($dni / 23);
		$valor *= 23;
		$valor= $dni - $valor;
		$letras= "TRWAGMYFPDXBNJZSQVHLCKEO";
		$letraNif= substr ($letras, $valor, 1);
		return $letraNif;
	}
	
	private function setConfig() {
	}

    private function setAllowedParams() {

    	$this->params = (object) array(
			'serviceNumber'		=> filter_input(INPUT_GET, 'service_number', FILTER_SANITIZE_NUMBER_INT),
			'userNumber'		=> filter_input(INPUT_GET, 'user_number',    FILTER_SANITIZE_NUMBER_INT),
			'nodeId'			=> filter_input(INPUT_GET, 'node_id',        FILTER_SANITIZE_STRING),
			'confId'			=> null,
			'grupo'				=> filter_input(INPUT_GET, 'grupo',      	 FILTER_SANITIZE_STRING),
			'lastInput'			=> filter_input(INPUT_GET, 'last_input',   	 FILTER_SANITIZE_STRING),
			'jumpOkUser'		=> filter_input(INPUT_GET, 'jumpOkUser',     FILTER_SANITIZE_STRING),
			'jumpKoUser'		=> filter_input(INPUT_GET, 'jumpKoUser',     FILTER_SANITIZE_STRING), 
       	);
    }
	
}
