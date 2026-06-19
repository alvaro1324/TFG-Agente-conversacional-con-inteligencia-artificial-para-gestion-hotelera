<?php

class MonteLuzConf {

    const PROJECT_NAME = 'MonteLuz';

    public static $config = array(
    	
    	'prod' => array(
    			'logsPath'          => '',
    			'logsName'          => '',
                'awsAccessKeyId'    => '',
                'awsSecretAccessKey'=> '',
                'awsSessionToken'   => '',
                'awsRegion'         => '',
               
    	),

       
    );
    
    /**
     * @return array
     */
    public static function getConfigByEnvironment()
    {
    	$isDevelopment = get_cfg_var("dev_server") || get_cfg_var("prepro_server");
    	$environment = $isDevelopment ? "dev" : "prod";
    	 
    	return self::$config[$environment];
    }
   
}

?>